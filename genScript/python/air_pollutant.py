#!/opt/local/bin/python2.7
##
## A python code to calculate vertical dispersion potential based on the paper "Multilayer urban canopy modelling and mapping for traffic pollutant dispersion at high density urban areas" 
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
import xlwt
from scipy.interpolate import interp1d


global pi
pi = math.pi
global EPSILON
EPSILON = 0.00001
global MAXHEIGHT,RESOLUTION
WIND_DIRECTIONs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
WINDDIRECTION_ANGLESs=[270,247.5,225,202.5,180,157.5,135,112.5,90,67.5,45,22.5,0,337.5,315,292.5]

#to calculate u_star
U_star_lamda_f=[0.05037364, 0.057729945, 0.063935876, 0.06945358, 0.075428836, 0.08071492, 0.08645887, 0.09289184, 0.09955517, 0.10828367, 0.11724094, 0.12596802, 0.13676041, 0.14893006, 0.16293468, 0.17624964, 0.1895624, 0.20149805, 0.21297409, 0.22513852, 0.23661457, 0.2529098, 0.2646143, 0.2779253, 0.29927123, 0.31831923, 0.34081247, 0.359863, 0.3763891, 0.40232477, 0.43239823]
U_star_divided_Uref=[0.097159654, 0.10717187, 0.11468071, 0.122659355, 0.12907284, 0.13501716, 0.13970931, 0.14471413, 0.15050131, 0.15534855, 0.1594132, 0.162852, 0.16550735, 0.16800556, 0.16893794, 0.1689317, 0.16673452, 0.16485097, 0.16249816, 0.15983203, 0.15747923, 0.15340272, 0.14995433, 0.1460357, 0.14211331, 0.13600108, 0.13160865, 0.12800033, 0.12517567, 0.11968617, 0.11967205]
f=interp1d(U_star_lamda_f,U_star_divided_Uref,'linear')


def afdx1(DEM_array,m,n,WINDDIRECTION_angle,WINDDIRECTION_theta):
    h=DEM_array[m, n]
    if h >= MAXHEIGHT:h = MAXHEIGHT
    afdx1=0
    if (WINDDIRECTION_angle>0) and (WINDDIRECTION_angle<180):
        afdx1 = abs(Sin(WINDDIRECTION_theta)) * h
    return afdx1


def afdx2(DEM_array,m,n,WINDDIRECTION_angle,WINDDIRECTION_theta):
    h=DEM_array[m, n]
    if h >= MAXHEIGHT:h = MAXHEIGHT
    afdx2=0
    if (WINDDIRECTION_angle>180) and (WINDDIRECTION_angle<360):
        afdx2 = abs(Sin(WINDDIRECTION_theta)) * h
    return afdx2


def afdy1(DEM_array,m,n,WINDDIRECTION_angle,WINDDIRECTION_theta):
    h=DEM_array[m, n]
    if h >= MAXHEIGHT:h = MAXHEIGHT
    afdy1=0
    if (WINDDIRECTION_angle>90) and (WINDDIRECTION_angle<270):
        afdy1 = abs(Cos(WINDDIRECTION_theta)) * h 
    return afdy1

def afdy2(DEM_array,m,n,WINDDIRECTION_angle,WINDDIRECTION_theta):
    h=DEM_array[m, n]
    if h >= MAXHEIGHT:h = MAXHEIGHT
    afdy2=0
    if (WINDDIRECTION_angle>270) or (WINDDIRECTION_angle<90):
        afdy2 =abs(Cos(WINDDIRECTION_theta)) * h
    return afdy2

def afd(DEM_array,m,n,Tile_DEM_height,Tile_DEM_width,WINDDIRECTION_angle,WINDDIRECTION_theta):
    h=DEM_array[m, n]
    if h >= MAXHEIGHT:h = MAXHEIGHT
    afd = 0
    
    if math.sin(WINDDIRECTION_theta)>0:dx = 1
    elif math.sin(WINDDIRECTION_theta)<0 : dx=-1
    else:dx=0
    
    if math.cos(WINDDIRECTION_theta)>0:dy=-1
    elif math.cos(WINDDIRECTION_theta)<0: dy=1
    else:dy=0

    x=m+dx
    y=n+dy

    if((x >= 0) & (x <= Tile_DEM_height - 1)):
        hdx = DEM_array[x, n]
        #print(hdx)
        if (hdx >= MAXHEIGHT): hdx = MAXHEIGHT
        if ((round(h,4) - round(hdx,4))> EPSILON):afd = afd + abs(Sin(WINDDIRECTION_theta)) * (h - hdx)

    if((y >= 0) & (y <= Tile_DEM_width - 1)):
        hdy = DEM_array[m, y]
        if (hdy >= MAXHEIGHT): hdy = MAXHEIGHT
        if ((round(h,4) - round(hdy,4)) > EPSILON): afd = afd + abs(Cos(WINDDIRECTION_theta)) * (h - hdy)
        #print(hdy,(h - hdy))
    afd=round(afd,4)
    #print(afd,h,WINDDIRECTION_angle,WINDDIRECTION_theta,Cos(WINDDIRECTION_theta))
    return afd

def get_DEM_vertical_layer_i(DEM,Layer_depth,Layer_index):
    DEM_layer_i_tmp=Con(DEM-(Layer_depth*(Layer_index-1))>0,DEM-(Layer_depth*(Layer_index-1)),0)
    DEM_layer_i=Con(DEM_layer_i_tmp>Layer_depth,Layer_depth,DEM_layer_i_tmp)
    del DEM_layer_i_tmp
    return DEM_layer_i

def cal_Site_Cover_Ratio(DEM_Layer_i,Layer_index,Aggregate_RESOLUTION):
    arcpy.CheckOutExtension("Spatial")
    resample=Float(Con(DEM_Layer_i>0,1,0))
    outRaster=Aggregate(resample, Aggregate_RESOLUTION, "SUM", "EXPAND", "DATA")
    outRaster=outRaster*1.0/(Aggregate_RESOLUTION*Aggregate_RESOLUTION)
    arcpy.Delete_management(resample)
    del resample
    return outRaster
    #return resample

def cal_Frontal_Area_Density(DEM_Layer_i,Layer_index,Aggregate_RESOLUTION):
    raster_list=[]
    for WIND_DIRECTION in WIND_DIRECTIONs:
        #arcpy.AddMessage("Processing {0} Direction".format(WIND_DIRECTION))
        print("Processing {0} Direction".format(WIND_DIRECTION))
        WINDDIRECTION_angle=WINDDIRECTION_ANGLESs[WIND_DIRECTIONs.index(WIND_DIRECTION)]
        WINDDIRECTION_theta=math.radians(WINDDIRECTION_angle)
        DEM_array=arcpy.RasterToNumPyArray(DEM,nodata_to_value=0)
        Result_array=Tile_fad(DEM_array,0,0,WINDDIRECTION_angle,WINDDIRECTION_theta)
        ResultRaster = arcpy.NumPyArrayToRaster(Result_array,lowerLeft,x_cell_size=1)
        arcpy.DefineProjection_management(ResultRaster, spatialReference)
        ResultRaster.save(env.scratchWorkspace+"/DEM_Layer_"+str(Layer_index)+"_"+WIND_DIRECTION+".tif")
        raster_list.append(ResultRaster)
        del ResultRaster,Result_array,DEM_array
        if arcpy.Exists("in_memory"):
            arcpy.Delete_management("in_memory")
        gc.collect()
    arcpy.CheckOutExtension("Spatial")
    FAD_sum=CellStatistics(raster_list, "MEAN", "NODATA")
    FADRaster=Aggregate(FAD_sum, Aggregate_RESOLUTION, "MEAN", "EXPAND", "DATA")
    arcpy.Delete_management(FAD_sum)
    for raster in raster_list:arcpy.Delete_management(raster)
    arcpy.CheckInExtension("Spatial")
    if arcpy.Exists("in_memory"):arcpy.Delete_management("in_memory")
    gc.collect()
    return FADRaster


def cal_mass_exchange_velocity_ud(DEM_Layer_i_fad):
    arcpy.CheckOutExtension("Spatial")   
    DEM_Layer_i_fad_Array=arcpy.RasterToNumPyArray(DEM_Layer_i_fad,nodata_to_value=0)
    u_star_Array=numpy.where(DEM_Layer_i_fad_Array>=0.4, 0.12*Uref, f(DEM_Layer_i_fad_Array))
    u_star=arcpy.NumPyArrayToRaster(u_star_Array,lowerLeft,x_cell_size=RESOLUTION)
    arcpy.DefineProjection_management(u_star, spatialReference)
    mass_exchange_velocity_ud=u_star/pi/math.sqrt(2)
    arcpy.CheckInExtension("Spatial")
    #arcpy.Delete_management(u_star)
    del u_star,u_star_Array,DEM_Layer_i_fad_Array
    if arcpy.Exists("in_memory"):arcpy.Delete_management("in_memory")
    gc.collect()
    return mass_exchange_velocity_ud

def cal_dispersion_potential_V(Layer_index):
    V=0
    print(len(FAD_layer_list),len(SCR_layer_list))
    for i in range(Layer_index,DEM_layers_number+1):
        print("Processing Layer {0} dispersion potential V".format(i))
        DEM_Layer_i_Udi=Raster(Udi_layer_list[i-1]) #list begins with 0
        if(i==DEM_layers_number):DEM_Layer_i1_scr=0
        else:DEM_Layer_i1_scr=Raster(SCR_layer_list[i])
        arcpy.CheckOutExtension("Spatial")
        V=V+(1/(DEM_Layer_i_Udi*(1-DEM_Layer_i1_scr)))
        #arcpy.Delete_management(Udi)
        del DEM_Layer_i_Udi
        arcpy.CheckInExtension("Spatial")
        if arcpy.Exists("in_memory"):arcpy.Delete_management("in_memory")
        gc.collect()
    arcpy.CheckOutExtension("Spatial")
    V=1/V
    arcpy.CheckInExtension("Spatial")
    return V    
    
def get_air_pollutant_model_u_parameters():
    air_pollutant_model_u_parameters_path=r"C:\Users\akihw\Yuan Chao's Lab Dropbox\wenhui he\software_development\ARCGIS_toolbox_development\dispersion_tool\air_pollutant_model_u_parameters.xlsx"
    wb = xlrd.open_workbook(filename=excel_path)
    sheet1 = wb.sheet_by_index(0)
    col1 = sheet1.col_values(0)
    col2 = sheet1.col_values(1)

    
class LicenseError(Exception):
    pass


######################################################################################################

#input parameters
#RASTER_DEM=arcpy.GetParameterAsText(0)
RASTER_DEM=r"C:\Users\akihw\Yuan Chao's Lab Dropbox\wenhui he\software_development\ARCGIS_toolbox_development\dispersion_tool\test_version\test_data_for_air_pollutant2\building_height.tif"
#RESOLUTION=int(arcpy.GetParameterAsText(1))
RESOLUTION=200
#Layer_depth=int(arcpy.GetParameterAsText(2))
Layer_depth=10
#Uref=float(arcpy.GetParameterAsText(3))
Uref=7.4

#output parameters
#output_path=arcpy.GetParameterAsText(4)
output_path=r"C:\Users\akihw\Yuan Chao's Lab Dropbox\wenhui he\software_development\ARCGIS_toolbox_development\dispersion_tool\test_version\test_result2"
#output_name=arcpy.GetParameterAsText(5)
output_name="dem_layer"
                        
#initial parameters
MAXHEIGHT=Layer_depth+1 #for FAD calculation
env.workspace=output_path
arcpy.env.overwriteOutput = True
parameters_folder=output_path+"/parameters_folder/"
if not os.path.exists(parameters_folder):os.makedirs(parameters_folder)
env.scratchWorkspace=parameters_folder


DEM=arcpy.Raster(RASTER_DEM)
DEM_width=DEM.width
DEM_height=DEM.height
lowerLeft = arcpy.Point(DEM.extent.XMin, DEM.extent.YMin)
NoDataValue=DEM.noDataValue
print(NoDataValue)
spatialReference=DEM.spatialReference
print("The maximum building height is {0} m".format(DEM.maximum))
DEM_layers_number=int(round(DEM.maximum/Layer_depth))
print("The urban canopy is divided into {0} multiple layers with a layer depth of {1}m".format(DEM_layers_number,Layer_depth))


FAD_layer_list=[]
SCR_layer_list=[]
Udi_layer_list=[]
V_layer_list=[]


for i in range(1,DEM_layers_number+1):
    arcpy.CheckOutExtension("Spatial")
    print("processing Layer {0}".format(i))
    DEM_Layer_i=get_DEM_vertical_layer_i(DEM,Layer_depth,i)
    DEM_Layer_i.save(env.scratchWorkspace+"/"+output_name+"_"+str(i)+".tif")
    DEM_Layer_i_scr=cal_Site_Cover_Ratio(DEM_Layer_i,i,RESOLUTION)
    DEM_Layer_i_scr.save(env.scratchWorkspace+"/"+output_name+"_"+str(i)+"_scr.tif")
    DEM_Layer_i_fad=cal_Frontal_Area_Density(DEM_Layer_i,i,RESOLUTION)
    DEM_Layer_i_fad.save(env.scratchWorkspace+"/"+output_name+"_"+str(i)+"_fad.tif")
    DEM_Layer_i_Udi=cal_mass_exchange_velocity_ud(DEM_Layer_i_fad)
    DEM_Layer_i_Udi.save(env.scratchWorkspace+"/"+output_name+"_"+str(i)+"_Udi.tif")
    SCR_layer_list.append(env.scratchWorkspace+"/"+output_name+"_"+str(i)+"_scr.tif")
    FAD_layer_list.append(env.scratchWorkspace+"/"+output_name+"_"+str(i)+"_fad.tif")
    Udi_layer_list.append(env.scratchWorkspace+"/"+output_name+"_"+str(i)+"_Udi.tif")
    del DEM_Layer_i,DEM_Layer_i_scr,DEM_Layer_i_fad,DEM_Layer_i_Udi
    if arcpy.Exists("in_memory"):arcpy.Delete_management("in_memory")
    gc.collect()
    arcpy.CheckInExtension("Spatial")

for i in range(1,DEM_layers_number+1):
    print("processing Layer {0} V".format(i))
    DEM_Layer_i_V=cal_dispersion_potential_V(i)
    DEM_Layer_i_V.save(output_name+"_"+str(i)+"_V.tif")
    V_layer_list.append(output_name+"_"+str(i)+"_V.tif")
    del DEM_Layer_i_V
    if arcpy.Exists("in_memory"):arcpy.Delete_management("in_memory")
    gc.collect()
arcpy.CheckOutExtension("Spatial")
V_avg=CellStatistics(V_layer_list, "MEAN", "NODATA")
V_avg.save(output_name+"_avg_V.tif")
del V_avg

arcpy.CheckOutExtension("Spatial")
if arcpy.Exists("in_memory"):arcpy.Delete_management("in_memory")
gc.collect()
arcpy.CheckInExtension("Spatial")
print("finished")




