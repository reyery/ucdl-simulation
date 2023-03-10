import { AfterViewInit, Component, HostListener } from '@angular/core';
import * as itowns from 'itowns';
import * as THREE from 'three';
import { BUILDING_TILES_URL, DEFAULT_LONGLAT, LONGLAT, SHOW_BUILDINGS, SIM_DATA } from './viewer.const';
import { getResultLayer, removeResultLayer, updateHUD } from './viewer.getresult';
import proj4 from 'proj4';

import GeoJSON from 'ol/format/GeoJSON.js';
import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/Tile.js';
import TileWMS from 'ol/source/TileWMS.js';
import View from 'ol/View.js';
import XYZ from 'ol/source/XYZ';
import Draw from 'ol/interaction/Draw.js';
import { bbox as bboxStrategy } from 'ol/loadingstrategy.js';
import { Modify, Select, Translate } from 'ol/interaction.js';
import { useGeographic } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { removeSimulation, runSimulation } from './viewer.simulation';

useGeographic();

const TILE_SIZE = 500


function _createProjection() {
  // create the function for transformation
  const proj_str_a = '+proj=tmerc +lat_0=';
  const proj_str_b = ' +lon_0=';
  const proj_str_c = '+k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs';
  let longitude = LONGLAT[0];
  let latitude = LONGLAT[1];
  const proj_from_str = 'WGS84';
  const proj_to_str = proj_str_a + latitude + proj_str_b + longitude + proj_str_c;
  const proj_obj = proj4(proj_from_str, proj_to_str);
  return proj_obj;
}
function fillString(x) {
  if (x < 0) {
    const s = x.toString()
    return '-' + ('00000' + s.slice(1)).slice(s.length - 1)
  }
  const s = x.toString()
  return ('00000' + s).slice(s.length)
}

const PROJ = _createProjection()
const POINT_MATERIAL = new THREE.PointsMaterial({
  color: 0xAAAAAA,
  size: 100,
  sizeAttenuation: false
});


@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html'
})
export class ViewerComponent implements AfterViewInit {
  public viewer: any;
  // the GI model to display

  public container;
  public view;
  public camTarget;
  public updatedGrids: Set<string> = new Set();
  public updatedBuildings: Set<string> = new Set();
  public fileQueue: string[] = [];
  public selected_simulation = SIM_DATA['none'];
  public sim_data_list = Object.values(SIM_DATA);

  public openLayersOn = false;
  public drawModeOn = true;
  public drawSim = SIM_DATA['sky'];

  private map;
  private featureSource;
  private interactions;

  private itown_layers = {}


  constructor() {
  }

  ngAfterViewInit(): void {
    this.createGeoViewer();
    if (!SHOW_BUILDINGS) return;
    setTimeout(() => {
      this.getAllBuildings()
    }, 1000);
  }

  // @HostListener('document:mousedown', ['$event'])
  // onmousedown(event: MouseEvent) {
    
  // }
  @HostListener('document:mouseup', ['$event'])
  onmousedown(event: MouseEvent) {
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
    const sim_container = document.getElementById('sim_select_apply') as HTMLDivElement
    if (!sim_container.classList.contains('hidden')) {
      let target = event.target as HTMLElement
      while (true) {
        console.log(target)
        if (target.id === 'drawsim_select_container') {
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

  }

  @HostListener('document:keyup', ['$event'])
  onkeyup(event: KeyboardEvent) {
    if ((event.key === 'Backspace' || event.key === 'Delete') && this.openLayersOn) {
      this.interactions[0].removeLastPoint()
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

    this.container = document.getElementById('itowns_container');
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
      this.toggleElement('toggle_openlayers_container', false)
    } else {
      getResultLayer(this.view, this.selected_simulation, this.itown_layers)
      if (this.openLayersOn) {
        this.toggleOpenlayersMode()
      }
      this.toggleElement('toggle_openlayers_container', true)
    }

    this.switchBuildingLayer(this.selected_simulation.building_type)
  }

  changeDrawSim(event: MouseEvent, new_sim: string) {
    event.stopPropagation()
    this.drawSim = SIM_DATA[new_sim]
    this.toggleElement('sim_select_apply', true)
    // this.switchBuildingLayer(this.drawSim.building_type)
  }

  toggleOpenlayersMode() {
    this.openLayersOn = !this.openLayersOn;

    if (this.openLayersOn) {
      this.toggleElement('openlayers_container', false)
      this.toggleElement('simulation_select', false)
    } else {
      this.toggleElement('openlayers_container', true)
      this.toggleElement('simulation_select', true)
    }


    if (this.openLayersOn) {
      this.toggleElement('itowns_container', true)
      this.toggleElement('leaflet_container', false)
      if (!this.map) {
        setTimeout(() => {
          this.createLeafletMap();
        }, 0);
      } else {
        this.updateLeafletMapPos()
      }
    } else {
      this.toggleElement('leaflet_container', true)
      this.toggleElement('itowns_container', false)
    }
  }

  toggleOpenlayersBtnClass() {
    if (this.openLayersOn) {
      return "inline-flex justify-center w-10 h-10 px-1 py-2 text-sm font-medium text-gray-700 bg-blue-300 border border-gray-300 rounded-md shadow-sm hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
    }
    return "inline-flex justify-center w-10 h-10 px-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100"
  }

  toggleDrawMode() {
    this.drawModeOn = !this.drawModeOn;
    if (this.drawModeOn) {
      this.map.addInteraction(this.interactions[0])
      this.map.removeInteraction(this.interactions[1])
      this.map.removeInteraction(this.interactions[2])
    } else {
      this.map.removeInteraction(this.interactions[0])
      this.map.addInteraction(this.interactions[1])
      this.map.addInteraction(this.interactions[2])
    }
  }

  toggleDrawBtnClass() {
    if (this.drawModeOn) {
      return "inline-flex justify-center w-8 h-8 p-1 font-medium text-gray-700 bg-blue-300 border border-gray-300 rounded-t-md hover:bg-blue-200 focus:outline-none focus:ring-0"
    }
    return "inline-flex justify-center w-8 h-8 p-1 font-medium text-gray-700 bg-white border border-gray-300 rounded-t-md hover:bg-gray-100 focus:outline-none focus:ring-0"
  }

  
  resetDrawing() {
    console.log(this.interactions[0])
    this.interactions[0].abortDrawing()
    this.featureSource.clear()
    if (!this.drawModeOn) {
      this.toggleDrawMode()
    }
  }

  updateLeafletMapPos() {
    const mapView = this.map.getView()
    const lookCoord = this.view.controls.getLookAtCoordinate()
    const currentZoom = this.view.controls.getZoom()
    console.log('currentZoom', currentZoom)

    mapView.setZoom(currentZoom + 1)
    mapView.setCenter([lookCoord.x, lookCoord.y]);
  }

  createLeafletMap() {
    const source = new VectorSource({ wrapX: false });

    const map_layer = new TileLayer({
      source: new XYZ({
        attributions: 'Map data ©2019 <a href="https://www.google.com/">Google</a>',
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
      }),
    })

    const vector_layer = new VectorLayer({
      source: source,
    });

    // const building_source = new VectorSource({
    //   format: new GeoJSON(),
    //   url: function (extent) {
    //     const str = BUILDING_TILES_URL + 'service=WFS&' +
    //       'version=1.0.0&request=GetFeature&typeName=sg_sim%3Asg_buildings&' +
    //       'outputFormat=application%2Fjson&srsname=EPSG:4326&' +
    //       'bbox=' + extent.join(',')
    //     return (str);
    //   },
    //   strategy: bboxStrategy,
    // });
    // const building_layer = new VectorLayer({
    //   source: building_source,
    //   style: {
    //     'stroke-width': 0.75,
    //     'stroke-color': 'white',
    //     'fill-color': 'rgba(222,222,222,1)',
    //   },
    //   minZoom: 15
    // });
    const building_layer =new TileLayer({
      extent: [103.60305, 1.21725, 104.08385, 1.47507],
      source: new TileWMS({
        url: BUILDING_TILES_URL.replace('wfs', 'wms'),
        params: {'LAYERS': 'sg_sim:sg_buildings', 'TILED': true},
        serverType: 'geoserver',
      }),
    })
  
    const road_layer =new TileLayer({
      extent: [103.60305, 1.21725, 104.08385, 1.47507],
      source: new TileWMS({
        url: BUILDING_TILES_URL.replace('wfs', 'wms'),
        params: {'LAYERS': 'sg_sim:sg_roads', 'TILED': true},
        serverType: 'geoserver',
      }),
    })
  

    const draw = new Draw({
      source: source,
      type: 'Polygon',
    });

    const select = new Select();
    const modify = new Modify({
      features: select.getFeatures(),
    });
    const translate = new Translate({
      features: select.getFeatures(),
    });

    const lookCoord = this.view.controls.getLookAtCoordinate()
    const currentZoom = this.view.controls.getZoom()
    console.log('currentZoom', currentZoom)
    const map = new Map({
      layers: [map_layer,
        road_layer,
        building_layer,
        vector_layer],
      target: 'leaflet_container',
      view: new View({
        center: [lookCoord.x, lookCoord.y],
        zoom: currentZoom + 1,
        maxZoom: 22
      }),
    });

    draw.addEventListener('drawstart', (data) => {
      console.log('draw start', data)
      source.clear()
    })
    draw.addEventListener('drawend', (data) => {
      console.log('draw end', data)
      const btn = document.getElementById('toggle_draw_btn')
      if (btn) { btn.click() }
    })

    map.addInteraction(draw);

    this.map = map
    this.featureSource = source
    this.interactions = [draw, select, modify, translate]
  }

  async runSim() {
    console.log('run sim!!!')
    const features = this.featureSource.getFeatures()
    if (!features || features.length <= 0) { return }
    setLoading(true)
    try {
      const newCenter = this.map.getView().getCenter()
      removeSimulation(this.view);
      await runSimulation(this.view, features[0].getGeometry(), this.drawSim)
      try {
        console.log('newCenter', newCenter)
        if (newCenter[0] && newCenter[1]) {
          const newViewCoord = new itowns.Coordinates('EPSG:4326', newCenter[0], newCenter[1])
          console.log('transformCameraToLookAtTarget coord:', newViewCoord)
          itowns.CameraUtils.transformCameraToLookAtTarget(this.view, this.view.camera.camera3D, {
            coord: newViewCoord
          })
        }
      }
      catch(ex) {
        console.log('error getting coordinate!!!', ex)
      }
    } catch (ex) {
      console.log('ERROR!!!', ex)
    }
    setLoading(false)
    this.toggleOpenlayersMode()
  }

  switchBuildingLayer(type) {

    if (type === 'extruded') {
      const check = this.view.getLayerById('Buildings_extruded')
      if (!check) {
        console.log('~~~~~~~~~ add layer')
        setTimeout(() => {
          this.view.addLayer(this.itown_layers['buildings'])
        }, 0);
      }
    } else if (type === 'flat') {
      const tbr = this.view.getLayerById('Buildings_extruded')
      if (tbr) {
        setTimeout(() => {
          console.log('~~~~~~~~~ remove layer')
          this.view.removeLayer('Buildings_extruded')
        }, 0);
      }
    }
  }


  async getAllBuildings(): Promise<boolean> {
    // const roadSource = new itowns.WFSSource({
    //   url: BUILDING_TILES_URL,
    //   typeName: 'sg_sim:sg_roads',
    //   crs: 'EPSG:4326',
    // });

    // const roadLayer = new itowns.FeatureGeometryLayer('roads', {
    //   source: roadSource,
    //   style: new itowns.Style({
    //     stroke: {
    //       color: new THREE.Color(0xdddddd),
    //       base_altitude: 0.1,
    //       width: properties => {
    //         console.log(properties)
    //         console.log(properties.TRAFFIC_DI)
    //         return 8
    //         // if (properties.TRAFFIC_DI === 12) {
    //         //   return '5'
    //         // } else if (properties.TRAFFIC_DI === 22){
    //         //   return '3'
    //         // }
    //         // console.log('unaccounted for width:', properties.TRAFFIC_DI)
    //         // return '1'
    //       }
    //     },
    //   }),
    // });

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

