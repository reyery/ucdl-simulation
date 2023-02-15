

from osgeo import gdal, ogr, osr

def test_rasterize_1():

    # Setup working spatial reference
    sr_wkt = 'LOCAL_CS["arbitrary"]'
    sr = osr.SpatialReference(sr_wkt)

    # Create a memory raster to rasterize into.

    target_ds = gdal.GetDriverByName("MEM").Create("", 100, 100, 3, gdal.GDT_Byte)
    target_ds.SetGeoTransform((1000, 1, 0, 1100, 0, -1))
    target_ds.SetProjection(sr_wkt)

    # Create a memory layer to rasterize from.

    rast_ogr_ds = ogr.GetDriverByName("Memory").CreateDataSource("wrk")
    rast_mem_lyr = rast_ogr_ds.CreateLayer("poly", srs=sr)

    # Add a polygon.

    wkt_geom = "POLYGON((1020 1030,1020 1045,1050 1045,1050 1030,1020 1030))"

    feat = ogr.Feature(rast_mem_lyr.GetLayerDefn())
    feat.SetGeometryDirectly(ogr.Geometry(wkt=wkt_geom))

    rast_mem_lyr.CreateFeature(feat)

    # Add a linestring.

    wkt_geom = "LINESTRING(1000 1000, 1100 1050)"

    feat = ogr.Feature(rast_mem_lyr.GetLayerDefn())
    feat.SetGeometryDirectly(ogr.Geometry(wkt=wkt_geom))

    rast_mem_lyr.CreateFeature(feat)

    # Run the algorithm.

    err = gdal.RasterizeLayer(
        target_ds, [3, 2, 1], rast_mem_lyr, burn_values=[256, 220, -1]
    )

    if (err != 0):
        print("got non-zero result code from RasterizeLayer")
        return

    # Check results.

    expected = 6452
    checksum = target_ds.GetRasterBand(2).Checksum()
    if checksum != expected:
        print(checksum)
        gdal.GetDriverByName("GTiff").CreateCopy("tmp/rasterize_1.tif", target_ds)
        print("Error: Did not get expected image checksum")
        return

    _, maxval = target_ds.GetRasterBand(3).ComputeRasterMinMax()
    print("maxval == 255", maxval)


    minval, _ = target_ds.GetRasterBand(1).ComputeRasterMinMax()
    print("minval == 0", minval)

test_rasterize_1()