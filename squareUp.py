import sys
from PIL import Image
import os
import re
import math
import sys
import extcolors
import numpy as np
import json

folderNames = ['PokemonPics']
heightOrWidth = {'h':1, 'w':0}

def getImageType(imName):
    if 'png' in imName.lower():
        return 'RGBA'
    return 'RGB'

def newFileExists(imName, yearFolderName):
    newFileLocation = 'C:\\Users\\DareA\\OneDrive\\Desktop\\PhotoOverhaul\\SquarePokemonPics'
    newImagePath = os.path.join(newFileLocation, yearFolderName, imName)
    if os.path.isfile(newImagePath):
        return True
    return False

def saveNewSquareImage(newIm, imName, yearFolderName):
    newFileLocation = 'C:\\Users\\DareA\\OneDrive\\Desktop\\PhotoOverhaul\\SquarePokemonPics'
    newImagePath = os.path.join(newFileLocation, imName)
    newIm.save(newImagePath)
    

def getMaxHeightOrWidth(imFile):
    hw = -1
    maxHW = -1
    w, h = imFile.size
    sizeDiff = w - h
    print(w, h)
    if sizeDiff > 0:
        hw = heightOrWidth['w']
        maxHW = w
    if sizeDiff < 0:
        hw = heightOrWidth['h']
        maxHW = h
    return maxHW, hw, abs(sizeDiff)

def concatBorders(im, maxSize, sizeDiff, hw, imType):
    #im.show()
    if hw == heightOrWidth['h']:
        emptyBorder = Image.new(imType, (sizeDiff,maxSize))
    if hw == heightOrWidth['w']:
        emptyBorder = Image.new(imType, (maxSize,sizeDiff))
    borderArray = np.array(emptyBorder)
    imArray = np.array(im)
    #create empty of max by sizeDiff/2
    print('sizeDiff',sizeDiff,'maxSize', maxSize)
    print('imArray', imArray.shape)
    print('borderArray', borderArray.shape)
    retArray = np.concatenate((borderArray,imArray),hw)
    print('retArray', retArray.shape)
    retArray = np.concatenate((retArray,borderArray),hw)
    print('retArray', retArray.shape)
    return Image.fromarray(retArray)

def processImage(iName):
    fileImage = Image.open(iName)
    print('fileImagesize', np.array(fileImage).shape)
    maxHW, hOrW, sizeDiff = getMaxHeightOrWidth(fileImage)
    sizeDiff = int(sizeDiff/2)
    if sizeDiff == 0:
        return fileImage
    return concatBorders(fileImage, maxHW, sizeDiff, hOrW, getImageType(iName))
    


def loopThroughFiles(folderName):
    for fName in os.listdir(folderName):
        imageName = os.path.join(folderName, fName)
        if os.path.isfile(imageName):
            if newFileExists(fName, folderName):
                continue
            squareImage = processImage(imageName)
            if squareImage:
                saveNewSquareImage(squareImage, fName, folderName)
            
    
def loopThroughFolders(folderNames):
    for folderName in folderNames:
        if os.path.isdir(folderName):
            loopThroughFiles(folderName)
            
            
            
loopThroughFolders(folderNames)