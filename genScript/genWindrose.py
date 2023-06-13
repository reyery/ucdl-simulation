from matplotlib import pyplot as plt
from windrose import WindroseAxes
import numpy as np
import json

WIND_DIRECTIONs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
# WINDDIRECTION_ANGLESs=[270,247.5,225,202.5,180,157.5,135,112.5,90,67.5,45,22.5,0,337.5,315,292.5]
WINDDIRECTION_ANGLESs=[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5]

wind_file = open('./genScript/sg_wind_all.json', 'r')
wind_file_str = wind_file.read()
wind_data = json.loads(wind_file_str)

stn_file = open('./genScript/sg_wind_station_data.json', 'r')
stn_file_str = stn_file.read()
stn_data = json.loads(stn_file_str)

for wind_stn in wind_data:
    # print(wind_stn, wind_data[wind_stn])
    ax = WindroseAxes.from_ax()
    angles = []
    wind = []
    for i in range(len(WINDDIRECTION_ANGLESs)):
        for j in range(round(2000 * wind_data[wind_stn][i])):
            angles.append(WINDDIRECTION_ANGLESs[i])
            wind.append(j)
    ax.bar(angles, wind, normed=True, opening=0.9) # colors='gray', 
    ax.set_xticklabels(['E', 'NE', 'N', 'NW',  'W', 'SW', 'S', 'SE'])
    for stn in stn_data:
        if stn['id'] == wind_stn:
            ax.set_title(stn['name'], {
                'fontsize': 24,
                'fontweight': 600
                })
    ax.set_yticklabels([])

    # ax.set_legend()
    plt.savefig('./src/assets/windrose/' + str(wind_stn) + '.png', transparent=True)