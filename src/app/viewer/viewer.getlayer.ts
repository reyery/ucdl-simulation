import * as itowns from 'itowns';

export function getLayers(): itowns.ColorLayer[] {
    const viewColorLayers: itowns.ColorLayer[] = [];
    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'OpenStreetMap',
            crs: 'EPSG:3857',
            format: 'image/png',
            url: 'https://a.tile.openstreetmap.org/${z}/${x}/${y}.png',
            attribution: {
                name: 'Open Street Map',
                html: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            },
            tileMatrixSet: 'PM',
            zoom: {
                min: 0,
                max: 19
            }
        })
    }));

    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'OpenTopoMap',
            crs: 'EPSG:3857',
            format: 'image/png',
            url: 'https://a.tile.opentopomap.org/${z}/${x}/${y}.png',
            attribution: {
                name: 'Open Topo Map',
                html: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            },
            tileMatrixSet: 'PM',
            zoom: {
                min: 0,
                max: 17
            }
        })
    }));

    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'Stamen Toner',
            crs: 'EPSG:3857',
            format: 'image/png',
            url: 'https://stamen-tiles.a.ssl.fastly.net/toner/${z}/${x}/${y}.png',
            attribution: {
                name: 'Stamen Toner',
                html: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
            tileMatrixSet: 'PM'
        })
    }));
    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'Stamen Terrain',
            crs: 'EPSG:3857',
            format: 'image/png',
            url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/${z}/${x}/${y}.png',
            attribution: {
                name: 'Stamen Terrain',
                html: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
            tileMatrixSet: 'PM',
            zoom: {
                min: 0,
                max: 18
            }
        })
    }));
    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'Stamen Watercolor',
            crs: 'EPSG:3857',
            format: 'image/png',
            url: 'https://stamen-tiles.a.ssl.fastly.net/watercolor/${z}/${x}/${y}.png',
            attribution: {
                name: 'Stamen Watercolor',
                html: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
            tileMatrixSet: 'PM',
            zoom: {
                min: 1,
                max: 16
            }
        })
    }));
    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.WMTSSource({
            name: 'ArcGIS Terrain',
            crs: 'EPSG:3857',
            format: 'image/jpg',
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/',
            attribution: {
                name: 'ArcGIS Terrain',
                html: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            },
            tileMatrixSet: 'PM'
        })
    }));

    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'Google Map - Roadmap',
            crs: 'EPSG:3857',
            format: 'image/jpg',
            url: 'https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}',
            attribution: {
                name: 'Google Map - Roadmap',
                html: 'Map data ©2019 <a href="https://www.google.com/">Google</a>',
            },
            tileMatrixSet: 'PM',
        })
    }));
    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'Google Map - Altered Roadmap',
            crs: 'EPSG:3857',
            format: 'image/jpg',
            url: 'https://mt1.google.com/vt/lyrs=r&x=${x}&y=${y}&z=${z}',
            attribution: {
                name: 'Google Map - Altered Roadmap',
                html: 'Map data ©2019 <a href="https://www.google.com/">Google</a>',
            },
            tileMatrixSet: 'PM',
        })
    }));
    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
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
    viewColorLayers.push(new itowns.ColorLayer('ColorLayer', {
        source: new itowns.TMSSource({
            name: 'Google Map - Hybrid',
            crs: 'EPSG:3857',
            format: 'image/jpg',
            url: 'https://mt1.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}',
            attribution: {
                name: 'Google Map - Hybrid',
                html: 'Map data ©2019 <a href="https://www.google.com/">Google</a>',
            },
            tileMatrixSet: 'PM',
        })
    }));


    const here1 = 'https://1.';
    const here2 = '.maps.ls.hereapi.com/maptile/2.1/maptile/newest/';
    const here3 = '/{z}/{x}/{y}/{width}/png8?apiKey=';

    return viewColorLayers;
}


export function getTerrains(): (null|itowns.ElevationLayer)[] {
    const viewElevationLayers: (null|itowns.ElevationLayer)[] = [];
    viewElevationLayers.push(null);
    viewElevationLayers.push(new itowns.ElevationLayer('ElevationLayer', {
        source: new itowns.WMTSSource({
            crs: 'EPSG:3857',
            url: 'http://wxs.ign.fr/3ht7xcw6f7nciopo16etuqp2/geoportail/wmts',
            name: 'Elevation',
            tileMatrixSet: 'WGS84G',
            format: 'image/x-bil;bits=32',
            attribution: {
                name: 'Elevation'
            }
        })
    }));
    return viewElevationLayers;
}

