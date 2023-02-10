import axios from "axios";
import * as itowns from 'itowns';
import * as THREE from "three";
import { RESULT_URL } from "./viewer.const";
// import { TIFFParser } from './TIFFParser.js'

export async function getResultLayer(view, type) {
  // itowns.Fetcher.arrayBuffer(RESULT_URL + 'result_1.tif')
  //   .then(TIFFParser.parse)
  //   .then(function _(texture) {
  //       var source = new itowns.FileSource({ features: texture });
  //       var layer = new itowns.ColorLayer('tiff', { source });
  //       view.addLayer(layer);
  //   });

  // var geometrySource = new itowns.OrientedImageSource({
  //   url: RESULT_URL + 'result_' + type + '.png',
  //   orientationsUrl: 'singapore_buildings_shp:singapore_buildings',
  //   crs: 'EPSG:4326',
  // });


  // const geometryLayer = new itowns.FeatureGeometryLayer('resultLayer', {
  //     source: geometrySource,
  //     style: new itowns.Style({
  //         fill: {
  //           pattern: RESULT_URL + 'result_' + type + '.png',
  //           base_altitude: 20,
  //         },
  //     }),
  // });

  const geometrySource = new itowns.FileSource({
    url:  RESULT_URL + 'coord1.geojson',
    crs: 'EPSG:4326',
    format: 'application/json',
  });

  const geometryLayer = new itowns.ColorLayer('resultLayer', {
    source: geometrySource,
    style: new itowns.Style({
      fill: {
        pattern: RESULT_URL + 'result_' + type + '.png',
        opacity: 0.5,
      },
      // fill: {
      //   color: 'cyan',
      //   opacity: 0.5,
      // },
      // stroke: {
      //   color: 'blue',
      // },
    }),
  });


  console.log(geometrySource)
  console.log(geometryLayer)
  view.addLayer(geometryLayer);
}
