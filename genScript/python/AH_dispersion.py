#!/opt/local/bin/python2.7
##
## A python code to calculate AH dispersion 
##
## Due to SSL certificate problem, this script has to be run with some version of python > 2.7.6
##
## Written by He Wenhui at FRS, Finished on August 24, 2021


import arcpy
from arcpy import env
from arcpy.sa import *
import math
import time
import numpy
import gc
import sys
import os
import shutil

global lambda_f_limit_for_calculation
global Uref
global Dc

lambda_f_limit_for_calculation=0.03
#Uref=7.4
Dc=17.183

class LicenseError(Exception):
    pass

def dtaT(Qa,lambda_p,lambda_f):
     raster=Con(lambda_f<lambda_f_limit_for_calculation,0,(1/Dc*(Qa/(Uref*(1- lambda_p)))*(1-(0.12*SquareRoot(2/lambda_f)))))
     return raster

#input parameters
Qa_path=arcpy.GetParameterAsText(0)
lambda_p_path=arcpy.GetParameterAsText(1)
lambda_f_path=arcpy.GetParameterAsText(2)
Uref=float(arcpy.GetParameterAsText(3))
#output parameters
output_path=arcpy.GetParameterAsText(4)
output_name=arcpy.GetParameterAsText(5)

#initial parameters
env.workspace=output_path
arcpy.env.overwriteOutput = True
env.scratchWorkspace=output_path
if arcpy.Exists(output_name+'.tif'):
    raise Exception(output_name +".tif already exists, please change the result name") 

try:
     if arcpy.CheckExtension("Spatial") == "Available":
          arcpy.CheckOutExtension("Spatial")
          arcpy.AddMessage("Checked out \"Spatial\" Extension")
          Qa=arcpy.Raster(Qa_path)
          spatialReference=Qa.spatialReference
          lambda_p=arcpy.Raster(lambda_p_path)
          lambda_f=arcpy.Raster(lambda_f_path)
          outRaster=dtaT(Qa,lambda_p,lambda_f)
          outRaster.save(output_name+'.tif')
          arcpy.CheckInExtension("Spatial")
          arcpy.AddMessage("Finished")
          if arcpy.Exists("in_memory"):arcpy.Delete_management("in_memory")
          gc.collect()
          mxd = arcpy.mapping.MapDocument("CURRENT")
          df = arcpy.mapping.ListDataFrames(mxd)[0]
          result=arcpy.MakeRasterLayer_management(outRaster,output_name)
          layer=result.getOutput(0)
          #sym.colorizer.colorRamp=
          #if layer.symbologyType == "RASTER_CLASSIFIED": lyr.symbology.reclassify()
          arcpy.mapping.AddLayer(df, layer)
          arcpy.RefreshActiveView()
     else:
          raise LicenseError
except LicenseError:
     arcpy.AddMessage("Spatial Analyst license is unavailable")
except:
     arcpy.AddMessage(arcpy.GetMessages())





