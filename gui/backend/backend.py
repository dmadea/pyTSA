
import sys, os

if sys.platform == 'darwin':
    sys.path.append(os.path.abspath("/Users/dominikmadea/Documents/Python + JS/pyTSA/pyTSA"))
else:
    sys.path.append(os.path.abspath(r'C:\Users\domin\Documents\Python + JS\pyTSA\pyTSA'))  # append library path to 


import numpy as np
import base64
from dataset import Dataset
from datasets import Datasets
from kineticmodel import FirstOrderModel, FirstOrderLPLModel


# fname = r"C:\Users\domin\Documents\Python + JS\pyTSA\gui\backend\HAP-3tBuTPA toluene degassed.txt"
fname = "HAP-3tBuTPA toluene degassed.txt"
fname = "/Users/dominikmadea/Documents/Python + JS/pyTSA/gui/backend/HAP-3tBuTPA toluene degassed.txt"
# fname = "test.txt"

def json2arr(base64_text: str) -> np.ndarray:
    bytes = base64.b64decode(base64_text)
    return np.frombuffer(bytes, dtype=np.float64)

def arr2json(arr: np.ndarray) -> str:
    _arr = arr if arr.data.c_contiguous else arr.T
    b64 = base64.b64encode(_arr)
    return b64.decode('utf-8')


def load_matrix(dataset: dict):
    t = json2arr(dataset['times'])
    w = json2arr(dataset['wavelengths'])
    mat = json2arr(dataset['matrix']['data'])
    c_contiguous = dataset['matrix']['c_contiguous']
    mat = mat.reshape((t.shape[0], w.shape[0]) if c_contiguous else (w.shape[0], t.shape[0])) 
    mat = mat if c_contiguous else mat.T
    return mat, t, w


class BackendSession(object):

    def __init__(self, app):
        self.datasets: Datasets = Datasets()
        self.app = app

        d = Dataset.from_file(fname, transpose=True, delimiter='\t')
        self.datasets.append(d)

    def post_datasets(self, data: dict):
        ds: list = data['data']['datasets']

        for d in ds:
            mat, t, w = load_matrix(d)
            dataset = Dataset(mat, t, w, name=d['name'])
            self.datasets.append(dataset)

        return ""
    
    def get_datasets(self):
        def _put_dataset(d: Dataset):
            obj = {
                'times': arr2json(d.times),
                'wavelengths': arr2json(d.wavelengths),
                'matrix': {
                    'data': arr2json(d.matrix),
                    'c_contiguous': d.matrix.data.c_contiguous
                },
                'name': d.name
            }

            return obj

        data = {
            'data': {
                'datasets': [_put_dataset(d) for d in self.datasets]
            }
        }

        return data


def get_data():
    # d = Dataset.from_file(fname, transpose=True, delimiter='\t')

    # it changes from the C and F contiguous arrays when transponsing the matrix
    arr = np.asarray([0, 1, 2, 3], dtype=np.int32).reshape((2, 2))

    print(arr.data.c_contiguous, arr.T.data.c_contiguous)

    new_arr = np.ascontiguousarray(arr)
    new_arrf = np.asfortranarray(arr)

    print(new_arr, new_arr.data.c_contiguous)
    print(new_arrf, new_arrf.data.c_contiguous)


    text = arr2json(new_arr)

    print(arr2json(new_arr))
    print(arr2json(new_arrf))


    # print(data, t, w, mm)

    # return data

    
if __name__ == '__main__':
    get_data()


