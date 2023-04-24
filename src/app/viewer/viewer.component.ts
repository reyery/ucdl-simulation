import { AfterViewInit, Component, HostListener } from '@angular/core';
import * as itowns from 'itowns';
import * as THREE from 'three';

import { BUILDING_TILES_URL, DEFAULT_LONGLAT, JS_SERVER, WGS84_SIM_PROJ, SHOW_BUILDINGS, SIM_DATA, SIM_DATA_UPLOAD } from './util/viewer.const';
import { getResultLayer, removeResultLayer, updateHUD } from './util/viewer.getresult';
import { runSimulation as runDrawSim } from './util/viewer.simulation';
import { runSimulation as runUploadSim } from './util/viewer.simulationUpload';
import { addViewGeom, removeSimulation } from './util/viewer.threejs';

import proj4 from 'proj4';
import * as shapefile from 'shapefile';

import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/Tile.js';
import TileWMS from 'ol/source/TileWMS.js';
import View from 'ol/View.js';
import XYZ from 'ol/source/XYZ';
import Draw from 'ol/interaction/Draw.js';
import Graticule from 'ol/layer/Graticule.js';
import Stroke from 'ol/style/Stroke.js';
import { getArea } from 'ol/sphere.js';
import { Feature, Image as OlImage, Overlay } from 'ol';
import CircleStyle from 'ol/style/Circle.js';
import MousePosition from 'ol/control/MousePosition.js';
import { createStringXY } from 'ol/coordinate.js';
import { defaults as defaultControls } from 'ol/control.js';

import { Modify, Select, Translate } from 'ol/interaction.js';
import { useGeographic } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Polygon } from 'ol/geom';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import { SIMFuncs } from '@design-automation/mobius-sim-funcs';
import Shape from '@doodle3d/clipper-js';
import { readMassingFiles } from './util/viewer.readMassingFile';

useGeographic();

const TILE_SIZE = 500
const AREA_TEXT_TEMPLATE = '<div styles="pointer-events: none;">Total Area: {{area}}km<sup>2</sup></div>'

function formatArea(polygon) {
  const area = getArea(polygon, { projection: 'EPSG:4326' });
  return AREA_TEXT_TEMPLATE.replace('{{area}}', (Math.round((area / 1000000) * 100) / 100).toString());
};
let measureTooltipElement;
let measureTooltip;
let changeCheck;


function simImportFeature(sim: SIMFuncs, feature: Feature) {
  const geom = (<Polygon>feature.getGeometry()).getCoordinates()
  const properties = feature.getProperties()
  const pgonHeight: number = properties['h'] ||
    properties['H'] || properties['height'] ||
    properties['Height'] || properties['AGL']

  if (geom.length === 1) {
    if (geom[0][0] === geom[0][geom[0].length - 1]) {
      geom[0].splice(geom[0].length - 1, 1)
    }
    const pgCoords = geom[0].map(c => {
      const coord = WGS84_SIM_PROJ.forward(c)
      coord.push(0)
      return sim.make.Position(coord)
    })
    const pg = sim.make.Polygon(pgCoords)
    const pg_norm = sim.calc.Normal(pg, 1)
    if (pg_norm[2] < 0) {
      sim.edit.Reverse(pg)
    }
    if (pgonHeight) {
      sim.make.Extrude(pg, pgonHeight, 1, <any>'quads')
      sim.edit.Delete(pg, <any>'delete_selected')
    }
  } else {

  }
}

function getThreeGeomCoords(threeObj): number[][][] {
  if (threeObj.type === 'Group') {
    let pgons = []
    for (const obj of threeObj.children) {
      pgons = pgons.concat(getThreeGeomCoords(obj))
    }
    return pgons
  } else if (threeObj.type === 'Mesh') {
    const gp = threeObj.geometry.attributes.position;
    const pgons: number[][][] = [];
    let pgonPos: number[][] = [];
    let pgonVertCount = 0
    for (let i = 0; i < gp.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(gp, i); // set p from `position`
      const coord = [p.x, p.y, p.z / 39.37]
      pgonPos.push(coord);
      pgonVertCount += 1
      if (pgonVertCount === 3) {
        pgonVertCount = 0
        pgons.push(pgonPos)
        pgonPos = []
      }
    }
    return pgons
  }
  return []
}

function featureStyleFunction(feature) {
  if (feature.get('draw_type') === 'sim_bound') {
    return new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#2563eb' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 2 })
      }),
      fill: new Fill({
        color: 'rgba(147, 197, 253, 0.3)',
      }),
      stroke: new Stroke({
        color: "#2563eb",
        width: 4,
      }),
    });
  } else if (feature.get('draw_type') === 'upload_bound') {
    return new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#eab308' }),
        stroke: new Stroke({ color: '#FFFFFF', width: 2 })
      }),
      fill: new Fill({
        color: 'rgba(252, 211, 77, 0.4)',
      }),
      stroke: new Stroke({
        color: "#eab308",
        width: 4,
      }),
    });
  }
  return new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#999999' }),
      stroke: new Stroke({ color: '#FFFFFF', width: 2 })
    }),
    fill: new Fill({
      color: 'rgba(200, 200, 200, 0.2)',
    }),
    stroke: new Stroke({
      color: "#999999",
      width: 4,
    }),
  });
};


enum OL_MODE {
  none = 'none',
  upload = 'upload',
  draw = 'draw',
}

enum OL_CTRL_MODE {
  none = 'none',
  draw_sim_bound = 'draw_sim_bound',
  draw_upload_bound = 'draw_upload_bound',
  upload_translate = 'upload_translate',
  upload_scale = 'upload_scale',
  upload_rotate = 'upload_rotate',
}

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html'
})
export class ViewerComponent implements AfterViewInit {
  public viewer: any;
  // the GI model to display

  public container: HTMLDivElement;
  public view: itowns.GlobeView;
  public camTarget;
  public updatedGrids: Set<string> = new Set();
  public updatedBuildings: Set<string> = new Set();
  public fileQueue: string[] = [];
  public selected_simulation = SIM_DATA['none'];
  public sim_data_list = Object.values(SIM_DATA);
  public sim_data_upload_list = Object.values(SIM_DATA_UPLOAD);

  private mousedownTime = null

  private olMode = OL_MODE.none

  private olCtrlMode = OL_CTRL_MODE.draw_sim_bound
  public drawSim = SIM_DATA['wind'];

  private map: Map;
  private drawSource: VectorSource;
  private interactions: [Draw, Select, Modify, Translate, Draw];


  private uploadSource: VectorSource;
  private uploadBoundSource: VectorSource;
  private uploadedGeomData: {
    extent: number[],
    data: string,
    sim: SIMFuncs,
    features: Feature<Polygon>[],
    simBoundary?: number[][],
    featureBoundary?: number[][]
  };
  private uploadedGeomTransf = {
    translate: [0, 0],
    scale: 1,
    rotate: 0
  }

  private itown_layers = {}


  constructor() {
  }

  ngAfterViewInit(): void {
    this.createGeoViewer();
    if (!SHOW_BUILDINGS) return;
    console.log(this.view)
    setTimeout(() => {
      setLoading(true)
      this.getAllBuildings()
      setLoading(false)
    }, 500);
  }

  /*****************************************
   * =========== EVENT LISTENERS ===========
   */
  @HostListener('document:mousedown', ['$event'])
  onmousedown(event: MouseEvent) {
    this.mousedownTime = event.timeStamp
  }
  @HostListener('document:mouseup', ['$event'])
  onmouseup(event: MouseEvent) {
    const timeDiff = event.timeStamp - this.mousedownTime
    this.mousedownTime = null
    const select_container = document.getElementById('sim_select_content') as HTMLDivElement
    if (!select_container.classList.contains('hidden')) {
      let target = event.target as HTMLElement
      while (true) {
        console.log(target)
        if (target.id === 'sim_select_container') {
          break
        }
        if (target.parentElement) {
          target = target.parentElement
        } else {
          select_container.classList.add('hidden')
          break;
        }
      }
    }
    let sim_container = document.getElementById('sim_select_apply') as HTMLDivElement
    if (!sim_container.classList.contains('hidden')) {
      let target = event.target as HTMLElement
      while (true) {
        console.log(target)
        if (target.id === 'drawsim_select_container' || target.id === 'drawsim_select_upload_container') {
          break
        }
        if (target.parentElement) {
          target = target.parentElement
        } else {
          sim_container.classList.add('hidden')
          break;
        }
      }
    }
    sim_container = document.getElementById('sim_select_upload_apply') as HTMLDivElement
    if (!sim_container.classList.contains('hidden')) {
      let target = event.target as HTMLElement
      while (true) {
        console.log(target)
        if (target.id === 'drawsim_select_container' || target.id === 'drawsim_select_upload_container') {
          break
        }
        if (target.parentElement) {
          target = target.parentElement
        } else {
          sim_container.classList.add('hidden')
          break;
        }
      }
    }
    if (this.olMode !== OL_MODE.upload ||
      this.olCtrlMode === OL_CTRL_MODE.none ||
      this.olCtrlMode === OL_CTRL_MODE.draw_sim_bound ||
      this.olCtrlMode === OL_CTRL_MODE.draw_upload_bound
    ) { return }
    if (timeDiff < 200) {
      this.transformUploadedModel(this.olCtrlMode).then(() => {
        addViewGeom(this.view, this.uploadedGeomData.sim, this.uploadedGeomData.extent, 'upload_model')
      })
      this.olCtrlMode = OL_CTRL_MODE.none
    }
  }
  @HostListener('document:mousemove', ['$event'])
  onmousemove(event: KeyboardEvent) {
    if (this.olMode !== OL_MODE.upload) { return }
    if (this.olCtrlMode === OL_CTRL_MODE.upload_translate) {
      const anchor = [
        (this.uploadedGeomData.extent[0] + this.uploadedGeomData.extent[2]) / 2,
        (this.uploadedGeomData.extent[1] + this.uploadedGeomData.extent[3]) / 2
      ]
      const mousePos = document.getElementById('mouse_position').innerText.split(',').map(x => Number(x))
      const translation = [mousePos[0] - anchor[0], mousePos[1] - anchor[1]]
      const newFeatures = []
      for (const f of this.uploadedGeomData.features) {
        const newGeom = f.getGeometry().clone()
        newGeom.translate(translation[0], translation[1])
        newFeatures.push(new Feature({ geometry: newGeom }))
      }
      this.uploadSource.clear()
      this.uploadSource.addFeatures(newFeatures)
    } else if (this.olCtrlMode === OL_CTRL_MODE.upload_scale) {
      const anchor = [
        (this.uploadedGeomData.extent[0] + this.uploadedGeomData.extent[2]) / 2,
        (this.uploadedGeomData.extent[1] + this.uploadedGeomData.extent[3]) / 2
      ]
      const baseDistSqr = Math.pow(anchor[0] - this.uploadedGeomData.extent[0], 2) + Math.pow(anchor[1] - this.uploadedGeomData.extent[1], 2)
      const mousePos = document.getElementById('mouse_position').innerText.split(',').map(x => Number(x))
      const newDist = Math.pow(anchor[0] - mousePos[0], 2) + Math.pow(anchor[1] - mousePos[1], 2)
      const scaling = Math.sqrt(newDist / baseDistSqr)

      const newFeatures = []
      for (const f of this.uploadedGeomData.features) {
        const newGeom = f.getGeometry().clone()
        newGeom.scale(scaling, scaling, anchor)
        newFeatures.push(new Feature({ geometry: newGeom }))
      }
      this.uploadSource.clear()
      this.uploadSource.addFeatures(newFeatures)

    } else if (this.olCtrlMode === OL_CTRL_MODE.upload_rotate) {
      const anchor = [
        (this.uploadedGeomData.extent[0] + this.uploadedGeomData.extent[2]) / 2,
        (this.uploadedGeomData.extent[1] + this.uploadedGeomData.extent[3]) / 2
      ]
      const mousePos = document.getElementById('mouse_position').innerText.split(',').map(x => Number(x))
      const mouseDirVect = [mousePos[0] - anchor[0], mousePos[1] - anchor[1]]

      const mouseAngle = Math.atan2(mouseDirVect[0], -mouseDirVect[1]);
      const horzAngle = Math.atan2(1, 0);
      const rotAngle = mouseAngle - horzAngle


      const newFeatures = []
      for (const f of this.uploadedGeomData.features) {
        const newGeom = f.getGeometry().clone()
        newGeom.rotate(rotAngle, anchor)
        newFeatures.push(new Feature({ geometry: newGeom }))
      }
      this.uploadSource.clear()
      this.uploadSource.addFeatures(newFeatures)

    }
  }
  @HostListener('document:keyup', ['$event'])
  onkeyup(event: KeyboardEvent) {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (this.olCtrlMode === OL_CTRL_MODE.draw_sim_bound) {
        this.interactions[0].removeLastPoint()
      } else if (this.olCtrlMode === OL_CTRL_MODE.draw_upload_bound) {
        this.interactions[4].removeLastPoint()
      }
    }
  }

  // matrix points from xyz to long lat
  /**
   *
   */
  public createGeoViewer() {
    const placement = {
      coord: new itowns.Coordinates('EPSG:4326', DEFAULT_LONGLAT[0], DEFAULT_LONGLAT[1]),
      range: 7000,
      tilt: 50
    };

    this.container = document.getElementById('itowns_container') as HTMLDivElement;
    // this.view = new itowns.GlobeView(this.container, placement);
    this.view = new itowns.GlobeView(this.container, placement);
    this.view.controls.enableDamping = false;
    this.view.controls.rotateSpeed = 0.5;
    this.view.mainLoop.gfxEngine.renderer.setPixelRatio(window.devicePixelRatio);
    this.view.mainLoop.gfxEngine.renderer.shadowMap.enabled = true;
    this.view.mainLoop.gfxEngine.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camTarget = this.view.controls.getLookAtCoordinate();

    this.view.controls.states.setFromOptions({
      ORBIT: { mouseButton: THREE.MOUSE.MIDDLE, enable: true, finger: 2 },
      PAN: { mouseButton: THREE.MOUSE.MIDDLE, keyboard: 17, enable: true, finger: 1 },
      MOVE_GLOBE: { mouseButton: THREE.MOUSE.LEFT, bottom: 40, left: 37, right: 39, up: 38, enable: true }
    });

    this.view.addLayer(new itowns.ColorLayer('ColorLayer', {
      source: new itowns.TMSSource({
        name: 'Google Map - Satellite Only',
        crs: 'EPSG:3857',
        format: 'image/jpg',
        url: 'https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}',
        attribution: {
          name: 'Google Map - Satellite Only',
          html: 'Map data ©2019 <a href="https://www.google.com/">Google</a>',
        },
        tileMatrixSet: 'PM',
      })
    }));

    // getResultAll(this.view, 'solar')
    addLight(this.view)
    updateHUD(this.selected_simulation)
  }

  async transformUploadedModel(mode: OL_CTRL_MODE) {
    if (mode === OL_CTRL_MODE.upload_translate) {
      const anchor = [
        (this.uploadedGeomData.extent[0] + this.uploadedGeomData.extent[2]) / 2,
        (this.uploadedGeomData.extent[1] + this.uploadedGeomData.extent[3]) / 2
      ]
      const newPos = document.getElementById('mouse_position').innerText.split(',').map(x => Number(x))
      const translation = [newPos[0] - anchor[0], newPos[1] - anchor[1]]

      const sim = this.uploadedGeomData.sim
      const newBottomLeft = WGS84_SIM_PROJ.forward([
        this.uploadedGeomData.extent[0] + translation[0],
        this.uploadedGeomData.extent[1] + translation[1]
      ])

      const allPos = sim.query.Get('ps' as any, null)
      sim.modify.Move(allPos, [newBottomLeft[0], newBottomLeft[1], 0])
      this.uploadedGeomData.data = await sim.io.ExportData(null, 'sim' as any)
      sim.modify.Move(allPos, [-newBottomLeft[0], -newBottomLeft[1], 0])

      this.uploadedGeomData.extent[0] = this.uploadedGeomData.extent[0] + translation[0]
      this.uploadedGeomData.extent[1] = this.uploadedGeomData.extent[1] + translation[1]
      this.uploadedGeomData.extent[2] = this.uploadedGeomData.extent[2] + translation[0]
      this.uploadedGeomData.extent[3] = this.uploadedGeomData.extent[3] + translation[1]

      for (const f of this.uploadedGeomData.features) {
        const geom = f.getGeometry()
        geom.translate(translation[0], translation[1])
      }
    } else if (mode === OL_CTRL_MODE.upload_scale) {
      const anchor = [
        (this.uploadedGeomData.extent[0] + this.uploadedGeomData.extent[2]) / 2,
        (this.uploadedGeomData.extent[1] + this.uploadedGeomData.extent[3]) / 2
      ]
      const baseDistSqr = Math.pow(anchor[0] - this.uploadedGeomData.extent[0], 2) + Math.pow(anchor[1] - this.uploadedGeomData.extent[1], 2)
      const mousePos = document.getElementById('mouse_position').innerText.split(',').map(x => Number(x))
      const newDist = Math.pow(anchor[0] - mousePos[0], 2) + Math.pow(anchor[1] - mousePos[1], 2)
      const scaling = Math.sqrt(newDist / baseDistSqr)

      const sim = this.uploadedGeomData.sim
      const anchorProj = WGS84_SIM_PROJ.forward(anchor)
      const bottomLeftProj = WGS84_SIM_PROJ.forward([this.uploadedGeomData.extent[0], this.uploadedGeomData.extent[1]])
      const scaledBottomLeftProj = [
        anchorProj[0] - (anchorProj[0] - bottomLeftProj[0]) * scaling,
        anchorProj[1] - (anchorProj[1] - bottomLeftProj[1]) * scaling
      ]

      const allPos = sim.query.Get('ps' as any, null)
      sim.modify.Move(allPos, [bottomLeftProj[0] - anchorProj[0], bottomLeftProj[1] - anchorProj[1], 0])
      sim.modify.Scale(allPos, [[0, 0, 0], [1, 0, 0], [0, 1, 0]], scaling)
      sim.modify.Move(allPos, [anchorProj[0], anchorProj[1], 0])
      this.uploadedGeomData.data = await sim.io.ExportData(null, 'sim' as any)
      sim.modify.Move(allPos, [-scaledBottomLeftProj[0], -scaledBottomLeftProj[1], 0])

      this.uploadedGeomData.extent[0] = anchor[0] - (anchor[0] - this.uploadedGeomData.extent[0]) * scaling
      this.uploadedGeomData.extent[1] = anchor[1] - (anchor[1] - this.uploadedGeomData.extent[1]) * scaling
      this.uploadedGeomData.extent[2] = anchor[0] + (anchor[0] - this.uploadedGeomData.extent[0])
      this.uploadedGeomData.extent[3] = anchor[1] + (anchor[1] - this.uploadedGeomData.extent[1])

      for (const f of this.uploadedGeomData.features) {
        const geom = f.getGeometry()
        geom.scale(scaling, scaling, anchor)
      }
    } else if (mode === OL_CTRL_MODE.upload_rotate) {
      const anchor = [
        (this.uploadedGeomData.extent[0] + this.uploadedGeomData.extent[2]) / 2,
        (this.uploadedGeomData.extent[1] + this.uploadedGeomData.extent[3]) / 2
      ]
      const mousePos = document.getElementById('mouse_position').innerText.split(',').map(x => Number(x))
      const mouseDirVect = [mousePos[0] - anchor[0], mousePos[1] - anchor[1]]
      const mouseAngle = Math.atan2(mouseDirVect[0], -mouseDirVect[1]);
      const horzAngle = Math.atan2(1, 0);
      const rotAngle = mouseAngle - horzAngle

      const sim = this.uploadedGeomData.sim
      const anchorProj = WGS84_SIM_PROJ.forward(anchor)
      const bottomLeftProj = WGS84_SIM_PROJ.forward([this.uploadedGeomData.extent[0], this.uploadedGeomData.extent[1]])

      const allPos = sim.query.Get('ps' as any, null)
      sim.modify.Move(allPos, [bottomLeftProj[0] - anchorProj[0], bottomLeftProj[1] - anchorProj[1], 0])
      sim.modify.Rotate(allPos, [0, 0, 1], rotAngle)
      sim.modify.Move(allPos, [anchorProj[0], anchorProj[1], 0])
      this.uploadedGeomData.data = await sim.io.ExportData(null, 'sim' as any)

      this.uploadedGeomData.extent = [9999, 9999, -9999, -9999]
      for (const f of this.uploadedGeomData.features) {
        const geom = f.getGeometry()
        geom.rotate(rotAngle, anchor)
        const geomExtent = geom.getExtent()
        this.uploadedGeomData.extent[0] = Math.min(this.uploadedGeomData.extent[0], geomExtent[0])
        this.uploadedGeomData.extent[1] = Math.min(this.uploadedGeomData.extent[1], geomExtent[1])
        this.uploadedGeomData.extent[2] = Math.max(this.uploadedGeomData.extent[2], geomExtent[2])
        this.uploadedGeomData.extent[3] = Math.max(this.uploadedGeomData.extent[3], geomExtent[3])
      }
      const rotatedBottomLeftProj = WGS84_SIM_PROJ.forward([this.uploadedGeomData.extent[0], this.uploadedGeomData.extent[1]])
      sim.modify.Move(allPos, [-rotatedBottomLeftProj[0], -rotatedBottomLeftProj[1], 0])
    }
  }


  toggleSelectElmSim(event: MouseEvent, elmID) {
    event.stopPropagation()
    const select_container = document.getElementById(elmID) as HTMLDivElement
    if (select_container.classList.contains('hidden')) {
      select_container.classList.remove('hidden');
    } else {
      select_container.classList.add('hidden');
    }
  }

  toggleElement(elmID: string, hideElm = true) {
    const elm = document.getElementById(elmID) as HTMLDivElement
    if (!elm) { return; }
    if (!hideElm && elm.classList.contains('hidden')) {
      elm.classList.remove('hidden');
    } else if (hideElm && !elm.classList.contains('hidden')) {
      elm.classList.add('hidden');
    }
  }

  changeSim(event: MouseEvent, new_sim: string) {
    event.stopPropagation()
    if (this.selected_simulation.id === new_sim) {
      this.toggleElement('sim_select_content', true)
      return;
    }
    removeSimulation(this.view)
    const current_sim_div = document.getElementById('current_sim') as HTMLDivElement
    if (current_sim_div) {
      current_sim_div.innerHTML = new_sim
    }
    removeResultLayer(this.view)
    this.selected_simulation = SIM_DATA[new_sim]

    setTimeout(() => {
      updateHUD(this.selected_simulation);
    }, 0);

    this.toggleElement('sim_select_content', true)
    if (new_sim === 'none') {
      // this.toggleElement('toggle_openlayers_container', false)
    } else {
      getResultLayer(this.view, this.selected_simulation, this.itown_layers)
      if (this.olMode === OL_MODE.draw) {
        this.toggleOpenlayersDrawMode()
      }
      // this.toggleElement('toggle_openlayers_container', true)
    }

    this.switchBuildingLayer(this.selected_simulation.building_type)
  }

  changeDrawSim(event: MouseEvent, new_sim: string) {
    event.stopPropagation()
    this.drawSim = SIM_DATA[new_sim]
    this.toggleElement('sim_select_apply', true)
    this.toggleElement('sim_select_upload_apply', true)
    // this.switchBuildingLayer(this.drawSim.building_type)
  }

  toggleOpenlayersDrawMode() {
    if (this.olMode === OL_MODE.upload) {
      this.olMode = OL_MODE.draw
      this.toggleElement('openlayers_upload_simBound_container', true)
    } else if (this.olMode === OL_MODE.draw) {
      this.olMode = OL_MODE.none
    } else {
      this.olMode = OL_MODE.draw
    }

    if (this.olMode === OL_MODE.draw) {
      if (this.uploadSource && this.uploadSource.getFeatures().length > 0) {
        this.uploadSource.clear()
      }
      if (this.uploadBoundSource && this.uploadBoundSource.getFeatures().length > 0) {
        this.resetDrawing()
      }
      this.switchBuildingLayer('extruded')
      this.toggleElement('openlayers_draw_ctrl_container', false)
      this.toggleElement('simulation_select_draw', false)
      this.toggleElement('simulation_select_upload', true)
      if (this.selected_simulation.id !== 'none') {
        this.changeSim(new MouseEvent(''), 'none')
      }
      this.toggleElement('itowns_container', true)
      this.toggleElement('openlayers_container', false)
      if (!this.map) {
        setTimeout(() => {
          this.createopenlayersMap();
        }, 0);
      } else {
        this.updateopenlayersMapPos()
      }
    } else {
      this.toggleElement('openlayers_draw_ctrl_container', true)
      this.toggleElement('simulation_select_draw', true)
      this.toggleElement('openlayers_container', true)
      this.toggleElement('itowns_container', false)
    }
  }

  toggleOpenlayersUploadMode() {
    if (this.olMode === OL_MODE.draw) {
      this.olMode = OL_MODE.upload
      this.toggleElement('openlayers_draw_ctrl_container', true)
    } else if (this.olMode === OL_MODE.upload) {
      this.olMode = OL_MODE.none
    } else {
      this.olMode = OL_MODE.upload
    }

    if (this.olMode === OL_MODE.upload) {
      this.toggleElement('openlayers_upload_simBound_container', false)
      this.toggleElement('openlayers_draw_ctrl_container', false)
      this.toggleElement('simulation_select_upload', false)
      this.toggleElement('simulation_select_draw', true)
      if (this.selected_simulation.id !== 'none') {
        this.changeSim(new MouseEvent(''), 'none')
      }
      this.switchBuildingLayer('flat')
      this.toggleElement('itowns_container', true)
      this.toggleElement('openlayers_container', false)
      if (!this.map) {
        setTimeout(() => {
          this.createopenlayersMap();
        }, 0);
      } else {
        this.updateopenlayersMapPos()
      }
    } else {
      this.toggleElement('openlayers_upload_simBound_container', true)
      this.toggleElement('openlayers_draw_ctrl_container', true)
      this.toggleElement('simulation_select_upload', true)
      this.toggleElement('openlayers_container', true)
      this.toggleElement('itowns_container', false)
    }
  }

  toggleOpenlayersDrawBtnClass() {
    if (this.olMode === OL_MODE.draw) {
      return "inline-flex justify-center w-10 h-10 px-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
    }
    return "inline-flex justify-center w-10 h-10 px-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
  }

  toggleOpenlayersUploadBtnClass() {
    if (this.olMode === OL_MODE.upload) {
      return "inline-flex justify-center w-10 h-10 px-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
    }
    return "inline-flex justify-center w-10 h-10 px-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
  }

  toggleDrawMode() {
    if (this.olCtrlMode === OL_CTRL_MODE.draw_upload_bound) {
      this.olCtrlMode = OL_CTRL_MODE.draw_sim_bound;
      this.map.addInteraction(this.interactions[0])
      this.map.removeInteraction(this.interactions[4])
    } else if (this.olCtrlMode === OL_CTRL_MODE.draw_sim_bound) {
      this.olCtrlMode = OL_CTRL_MODE.none
      this.map.removeInteraction(this.interactions[0])
      this.map.addInteraction(this.interactions[1])
      this.map.addInteraction(this.interactions[2])
    } else {
      this.olCtrlMode = OL_CTRL_MODE.draw_sim_bound
      this.map.addInteraction(this.interactions[0])
      this.map.removeInteraction(this.interactions[1])
      this.map.removeInteraction(this.interactions[2])
    }
  }

  toggleUpBoundDrawMode() {
    if (this.olCtrlMode === OL_CTRL_MODE.draw_sim_bound) {
      this.olCtrlMode = OL_CTRL_MODE.draw_upload_bound
      this.map.removeInteraction(this.interactions[0])
      this.map.addInteraction(this.interactions[4])
    } else if (this.olCtrlMode === OL_CTRL_MODE.draw_upload_bound) {
      this.olCtrlMode = OL_CTRL_MODE.none
      this.map.removeInteraction(this.interactions[4])
      this.map.addInteraction(this.interactions[1])
      this.map.addInteraction(this.interactions[2])
    } else {
      this.olCtrlMode = OL_CTRL_MODE.draw_upload_bound
      this.map.addInteraction(this.interactions[4])
      this.map.removeInteraction(this.interactions[1])
      this.map.removeInteraction(this.interactions[2])
    }
  }

  changeUploadMode(newCtrlMode: string) {
    for (const i of this.interactions) {
      this.map.removeInteraction(i)
    }
    for (const olCtrlMode in OL_CTRL_MODE) {
      if (olCtrlMode === newCtrlMode) {
        this.olCtrlMode = OL_CTRL_MODE[olCtrlMode]
      }
    }
  }

  toggleUploadTranslateMode() {
    for (const i of this.interactions) {
      this.map.removeInteraction(i)
    }
    this.olCtrlMode = OL_CTRL_MODE.upload_translate
  }

  getButtonClass(attr, val, btnClass) {

    if (this[attr] === val) {
      return btnClass + ' bg-blue-300 hover:bg-blue-200'
    }
    return btnClass + ' bg-white hover:bg-gray-100'
  }


  uploadBtnClick(event) {
    event.stopPropagation()
    if (this.olMode === OL_MODE.upload) {
      this.toggleOpenlayersUploadMode()
    } else {
      if (this.uploadSource && this.uploadSource.getFeatures().length === 0) {
        this.resetDrawing()
      }
      this.toggleOpenlayersUploadMode()
      document.getElementById('massing_upload').click()
    }
  }

  addUploadFeature(features: Feature<Polygon>[], count = 0) {
    if (this.uploadSource) {
      this.uploadSource.clear()
      this.uploadSource.addFeatures(features)
      this.map.getView().fit(this.uploadSource.getExtent(), { maxZoom: 18 })
      setTimeout(() => {
        // this.map.getView().fit(features)
      }, 100);
    } else {
      count += 1
      if (count >= 10) { return }
      setTimeout(() => {
        this.addUploadFeature(features, count)
      }, 100);
    }
  }

  async uploadMassing(event: Event) {
    const files = (<HTMLInputElement>event.target).files
    const currentItownCoord = this.view.controls.getLookAtCoordinate();
    console.log('currentItownCoord', currentItownCoord)
    const massingDataResult = await readMassingFiles(files, [currentItownCoord.x, currentItownCoord.y])
    if (massingDataResult) {
      this.uploadedGeomData = massingDataResult.uploadedGeomData
      this.addUploadFeature(this.uploadedGeomData.features)
      this.uploadedGeomTransf = {
        translate: [0, 0],
        scale: 1,
        rotate: 0
      }
      await addViewGeom(this.view, this.uploadedGeomData.sim, this.uploadedGeomData.extent, 'upload_model')
      if (massingDataResult.translateModeSwitch) {
        this.toggleUploadTranslateMode()
      }
    }
    (<HTMLInputElement>event.target).value = null
  }

  resetDrawing() {
    this.interactions[0].abortDrawing()
    this.interactions[4].abortDrawing()
    this.drawSource.clear()
    this.uploadBoundSource.clear()
    if (this.olCtrlMode === OL_CTRL_MODE.draw_sim_bound) {
      this.toggleDrawMode()
    }
    if (this.olCtrlMode === OL_CTRL_MODE.draw_upload_bound) {
      this.toggleUpBoundDrawMode()
    }
    if (measureTooltip) {
      this.map.removeOverlay(measureTooltip)
      measureTooltipElement = null
      measureTooltip = null
    }
    console.log(this.map)
  }

  updateopenlayersMapPos() {
    const mapView = this.map.getView()
    const lookCoord = this.view.controls.getLookAtCoordinate()
    const currentZoom = this.view.controls.getZoom()
    console.log('currentZoom', currentZoom)

    mapView.setZoom(currentZoom + 1)
    mapView.setCenter([lookCoord.x, lookCoord.y]);
  }

  createopenlayersMap() {
    const drawSource = new VectorSource({ wrapX: false });
    const uploadSource = new VectorSource({ wrapX: false });
    const uploadBoundSource = new VectorSource({ wrapX: false });

    const mapLayer = new TileLayer({
      source: new XYZ({
        attributions: 'Map data ©2019 <a href="https://www.google.com/">Google</a>',
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
      }),
    })

    const graticuleLayer = new Graticule({
      // the style to use for the lines, optional.
      strokeStyle: new Stroke({
        color: 'rgba(200,200,200,0.6)',
        width: 1,
        // lineDash: [2, 3],
      }),
      minZoom: 10,
      targetSize: 10,
      intervals: [100 / 111139],
      showLabels: true,
      wrapX: false,
    })


    const drawLayer = new VectorLayer({
      source: drawSource,
      style: new Style({
        fill: new Fill({
          color: 'rgba(147, 197, 253, 0.2)',
        }),
        stroke: new Stroke({
          color: "#60a5fa",
          width: 4,
        }),
      }),
    });
    const uploadBoundLayer = new VectorLayer({
      source: uploadBoundSource,
      style: new Style({
        fill: new Fill({
          color: 'rgba(252, 211, 77, 0.3)',
        }),
        stroke: new Stroke({
          color: "#facc15",
          width: 4,
        }),
      }),
    });

    const uploadLayer = new VectorLayer({
      source: uploadSource,
      style: new Style({
        fill: new Fill({
          color: 'rgba(255, 87, 51, 0.5)',
        }),
        stroke: new Stroke({
          color: "#FF5733",
          width: 4,
        }),
      }),
    });
    const buildingLayer = new TileLayer({
      extent: [103.60305, 1.21725, 104.08385, 1.47507],
      source: new TileWMS({
        url: BUILDING_TILES_URL.replace('wfs', 'wms'),
        params: { 'LAYERS': 'sg_sim:sg_buildings', 'TILED': true },
        serverType: 'geoserver',
      }),
    })

    const roadLayer = new TileLayer({
      extent: [103.60305, 1.21725, 104.08385, 1.47507],
      source: new TileWMS({
        url: BUILDING_TILES_URL.replace('wfs', 'wms'),
        params: { 'LAYERS': 'sg_sim:sg_roads', 'TILED': true },
        serverType: 'geoserver',
      }),
    })

    const mousePositionControl = new MousePosition({
      coordinateFormat: createStringXY(10),
      projection: 'EPSG:4326',
      // comment the following two lines to have the mouse position
      // be placed within the map.
      className: 'custom-mouse-position',
      target: document.getElementById('mouse_position'),
    });

    const lookCoord = this.view.controls.getLookAtCoordinate()
    const currentZoom = this.view.controls.getZoom()
    console.log('currentZoom', currentZoom)
    const map = new Map({
      layers: [
        mapLayer,
        roadLayer,
        buildingLayer,
        graticuleLayer,
        drawLayer,
        uploadBoundLayer,
        uploadLayer
      ],
      target: 'openlayers_container',
      view: new View({
        center: [lookCoord.x, lookCoord.y],
        zoom: currentZoom + 1,
        maxZoom: 22,
        // projection: 'EPSG:3414'
      }),
      controls: defaultControls().extend([mousePositionControl]),
    });

    function createMeasureTooltip() {
      if (measureTooltipElement) {
        measureTooltipElement.parentNode.removeChild(measureTooltipElement);
      }
      if (measureTooltip) {
        map.removeOverlay(measureTooltip)
      }
      measureTooltipElement = document.createElement('div');
      measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
      measureTooltip = new Overlay({
        element: measureTooltipElement,
        offset: [0, -15],
        positioning: 'bottom-center',
        stopEvent: false,
        insertFirst: false,
      });
      map.addOverlay(measureTooltip);
    }


    // selection
    const select = new Select({
      style: featureStyleFunction,
    });

    const modify = new Modify({
      features: select.getFeatures(),
      style: featureStyleFunction,
    });
    const translate = new Translate({
      features: select.getFeatures(),
    });

    const draw = new Draw({
      source: drawSource,
      type: 'Polygon',
    });

    draw.on('drawstart', (data) => {
      console.log('draw start', data)
      drawSource.clear()
      // set sketch
      createMeasureTooltip()
      //@ts-ignore
      const sketch = data.feature;

      //@ts-ignore
      let tooltipCoord = data.coordinate;

      sketch.getGeometry().on('change', function (evt) {
        const geom = evt.target;
        const output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
        measureTooltipElement.innerHTML = output;
        measureTooltip.setPosition(tooltipCoord);
        const current = Number(new Date())
        changeCheck = current
        setTimeout(() => {
          if (changeCheck === current) {
            console.log('!!!!!!!!!!')
          }
        }, 200);
      });
    })

    draw.on('drawend', (data) => {
      console.log('draw end', data)
      data.feature.set('draw_type', 'sim_bound')
      //@ts-ignore
      const bounds = data.feature.getGeometry().getCoordinates()[0]
      const btn = document.getElementById('toggle_draw_btn')
      if (btn) { btn.click() }

      measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
      measureTooltip.setOffset([0, -7]);

      fetch(JS_SERVER + 'getAreaInfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bounds: bounds
        })
      })
    })


    const uploadBoundDraw = new Draw({
      source: uploadBoundSource,
      type: 'Polygon',
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#facc15' }),
          stroke: new Stroke({ color: '#FFFFFF', width: 2 })
        }),
        fill: new Fill({
          color: 'rgba(252, 211, 77, 0.3)',
        }),
        stroke: new Stroke({
          color: "#facc15",
          width: 4,
        }),
      }),
    });

    uploadBoundDraw.on('drawstart', (data) => {
      console.log('draw area start', data)
      uploadBoundSource.clear()
    })

    uploadBoundDraw.on('drawend', (data) => {
      console.log('draw area end', data)
      data.feature.set('draw_type', 'upload_bound')
      const btn = document.getElementById('toggle_draw_area_btn')
      if (btn) { btn.click() }
    })

    createMeasureTooltip()
    map.addInteraction(draw);

    this.map = map
    this.drawSource = drawSource
    this.uploadSource = uploadSource
    this.uploadBoundSource = uploadBoundSource
    this.interactions = [draw, select, modify, translate, uploadBoundDraw]
  }
  async runSim() {
    if (this.olMode === OL_MODE.draw) {
      this.runSimDraw()
    } else if (this.olMode === OL_MODE.upload) {
      this.runSimUpload()
    }
  }

  async runSimDraw() {
    console.log('run draw sim!!!')
    const features = this.drawSource.getFeatures()
    if (!features || features.length <= 0) { return }
    setLoading(true)
    try {
      const newCenter = this.map.getView().getCenter()
      removeSimulation(this.view);
      await runDrawSim(this.view, (<Polygon>features[0].getGeometry()).getCoordinates(), this.drawSim)
      try {
        console.log('newCenter', newCenter)
        if (newCenter[0] && newCenter[1]) {
          const newViewCoord = new itowns.Coordinates('EPSG:4326', newCenter[0], newCenter[1])
          console.log('transformCameraToLookAtTarget coord:', newViewCoord)
          setTimeout(() => {
            itowns.CameraUtils.transformCameraToLookAtTarget(this.view, this.view.camera.camera3D, {
              coord: newViewCoord
            })
          }, 0);
        }
      }
      catch (ex) {
        console.log('error getting coordinate!!!', ex)
      }
    } catch (ex) {
      console.log('ERROR!!!', ex)
    }
    setLoading(false)
    this.toggleOpenlayersDrawMode()
  }

  async runSimUpload() {
    console.log('run upload sim!!!')
    if (!this.uploadedGeomData || this.olMode !== OL_MODE.upload) { return }

    setLoading(true)
    let simFeatures = this.drawSource.getFeatures()
    if (!simFeatures || simFeatures.length <= 0) {
      const ext = this.uploadedGeomData.extent
      this.uploadedGeomData.simBoundary = [
        [ext[0], ext[1]],
        [ext[0], ext[3]],
        [ext[2], ext[3]],
        [ext[2], ext[1]]
      ]
    } else {
      this.uploadedGeomData.simBoundary = (<Polygon>simFeatures[0].getGeometry()).getCoordinates()[0].slice(0, -1)
    }

    let uploadBoundFeature = this.uploadBoundSource.getFeatures()
    if (!uploadBoundFeature || uploadBoundFeature.length <= 0) {
      const ext = this.uploadedGeomData.extent
      this.uploadedGeomData.featureBoundary = [
        [ext[0], ext[1]],
        [ext[0], ext[3]],
        [ext[2], ext[3]],
        [ext[2], ext[1]]
      ]
    } else {
      this.uploadedGeomData.featureBoundary = (<Polygon>uploadBoundFeature[0].getGeometry()).getCoordinates()[0].slice(0, -1)
    }
    try {
      const newCenter = this.map.getView().getCenter()
      removeSimulation(this.view);
      await runUploadSim(this.view, this.uploadedGeomData, this.drawSim)
      if (newCenter && newCenter[0] && newCenter[1]) {
        const newViewCoord = new itowns.Coordinates('EPSG:4326', newCenter[0], newCenter[1])
        console.log('transformCameraToLookAtTarget coord:', newViewCoord)
        setTimeout(() => {
          itowns.CameraUtils.transformCameraToLookAtTarget(this.view, this.view.camera.camera3D, {
            coord: newViewCoord
          })
        }, 0);
      }
    } catch (ex) {
      console.log('ERROR!!!', ex)
    }

    setLoading(false)
    this.toggleOpenlayersUploadMode()
  }

  switchBuildingLayer(type) {
    if (type === 'extruded') {
      const check = this.view.getLayerById('Buildings_extruded')
      if (!check) {
        setTimeout(() => {
          this.view.addLayer(this.itown_layers['buildings'])
        }, 0);
      }
    } else if (type === 'flat') {
      const tbr = this.view.getLayerById('Buildings_extruded')
      if (tbr) {
        setTimeout(() => {
          this.view.removeLayer('Buildings_extruded')
        }, 0);
      }
    }
  }


  getAllBuildings(): boolean {
    const roadSource = new itowns.WMSSource({
      url: BUILDING_TILES_URL.replace('wfs', 'wms'),
      name: 'sg_roads',
      transparent: true,
      crs: 'EPSG:4326',
      extent: {
        west: '103.60305',
        east: '104.08385',
        south: '1.21725',
        north: '1.47507',
      },
    });

    const roadLayer = new itowns.ColorLayer('roads', {
      source: roadSource,
    });


    const geometrySource = new itowns.WFSSource({
      url: BUILDING_TILES_URL,
      typeName: 'sg_sim:sg_buildings',
      crs: 'EPSG:4326',
    });

    this.itown_layers['buildings'] = new itowns.FeatureGeometryLayer('Buildings_extruded', {
      source: geometrySource,
      style: new itowns.Style({
        fill: {
          color: new THREE.Color(0xdddddd),
          base_altitude: 0.1,
          extrusion_height: properties => properties.AGL,
        },
      }),
    });

    const wmsSource = new itowns.WMSSource({
      url: BUILDING_TILES_URL.replace('wfs', 'wms'),
      name: 'sg_buildings',
      transparent: true,
      crs: 'EPSG:4326',
      extent: {
        west: '103.60305',
        east: '104.08385',
        south: '1.21725',
        north: '1.47507',
      },
    });

    const flatBuilding = new itowns.ColorLayer('Buildings_flat', {
      source: wmsSource,
    });
    this.view.addLayer(roadLayer);
    this.view.addLayer(this.itown_layers['buildings']);
    this.view.addLayer(flatBuilding);
    return true
  }

}

function addLight(view) {
  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.4);
  view.scene.add(ambientLight);
  const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFF, 0.4);
  view.scene.add(hemiLight);
}

function setLoading(isLoading: boolean) {
  const loadingContainer = document.getElementById('isLoadingPanel') as HTMLDivElement
  if (!loadingContainer) { return }
  loadingContainer.classList.remove('hidden')
  if (isLoading === false) {
    loadingContainer.classList.add('hidden')
  }
}

