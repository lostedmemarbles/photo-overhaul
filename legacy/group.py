from PIL import Image
import os
import re
import math
import sys
import extcolors
import numpy as np
import json
from tkinter.filedialog import askopenfilename
import shutil
from PIL import ExifTags

# Prompt for directory
directory = 'C:\\Users\\DareA\\Downloads\\AllPhotos'
saveDir = 'C:\\Users\\DareA\\Downloads\\NoDupes'
dateSorted = 'C:\\Users\\DareA\\Downloads\\dateSorted'




def newFolderWithNoDupes():
    images = []
    numIm = 0
    for filename in os.listdir(directory):
        if not filename.lower().endswith('.heic') and not filename.lower().endswith('.mp4') and not filename.lower().endswith('.mov') and not filename.lower().endswith('.py'):  # Look for PNG files
            oldFile = os.path.join(directory, filename)
            img = Image.open(oldFile)
            if img in images:
                print('DUPPPPEEE')
                #img.show()
            else:
                images.append(img)
                numIm = numIm + 1
                filename = 'joshley' + str(numIm) + '.' + filename.split('.')[-1]
                newFile = os.path.join(saveDir, filename)
                shutil.copyfile(oldFile, newFile)
                #print(img)
    print(f"Loaded {len(images)} images from {directory}")
def checkJpgVersion():
    for filename in os.listdir(directory):
        if filename.lower().endswith('.heic'):
            jpgVersion = ''.join(filename.split('.')[:-1]) + '.jpg'
            if not os.path.isfile(jpgVersion):
                newFile = os.path.join('C:\\Users\\DareA\\Downloads\\heics', filename)
                shutil.copyfile(os.path.join(directory, filename), newFile)
                print(filename)
            #else:
            #    print('NAH')
    
def getDates():
    images = []
    dates = {}

    for filename in os.listdir(saveDir):
        oldFile = os.path.join(saveDir, filename)
        img = Image.open(oldFile)
        images.append(img)
        ifds = img.getexif()
        if 306 in ifds:
            date = ifds[306].split(' ')[0].replace(':', '_')
        else:
            date = 'unknown'
        newFile = ''
        if date not in dates:
            dates[date] = 0
        dates[date] = dates[date] + 1
        newFileName = date + '_' + str(dates[date]) + '.' + filename.split('.')[-1]
        newFile = os.path.join(dateSorted, newFileName)
        shutil.copyfile(oldFile, newFile)
        #for k, v in img.getexif().items():
        #    print("Tag", k, "Value", v)
    
def renameUnknowns(fp, year):
    for filename in os.listdir(fp):
        if filename.startswith('unknown'):
            oldFile = os.path.join(fp, filename)
            newFile = os.path.join(fp, str(year) + '_' + filename.split('_')[-1])
            shutil.copyfile(oldFile, newFile)
#newFolderWithNoDupes()
##getDates()
filePath = 'C:\\Users\\DareA\\Downloads\\dateSorted\\2015'
renameUnknowns(filePath, filePath.split('\\')[-1])