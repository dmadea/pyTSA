
import sys, os

sys.path.append(os.path.abspath(r'C:\Users\domin\Documents\Python + JS\pyTSA\pyTSA'))  # append library path to 

import numpy as np
import base64
from dataset import Dataset
from datasets import Datasets
from kineticmodel import FirstOrderModel, FirstOrderLPLModel


fname = r"C:\Users\domin\Documents\Python + JS\pyTSA\gui\backend\HAP-3tBuTPA toluene degassed.txt"


def get_data():
    d = Dataset.from_file(fname, delimiter='\t')

    times = base64.b64encode(d.times).decode('utf-8')
    wls = base64.b64encode(d.wavelengths).decode('utf-8')
    m = base64.b64encode(d.matrix).decode('utf-8')

    data = {'data': {
        'matrix_data': {
            'times': times,
            'wls': wls,
            'matrix': m,
        }
    }}

    return data

    
if __name__ == '__main__':
    get_data()


