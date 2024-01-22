
import sys, os

import numpy as np
import base64
try:
    from pyTSA import Dataset, Datasets, FirstOrderModel, FirstOrderLPLModel
except ImportError:
    if sys.platform == 'darwin':
        sys.path.append(os.path.abspath("/Users/dominikmadea/Documents/Python + JS/pyTSA"))
    else:
        sys.path.append(os.path.abspath(r'C:\Users\domin\Documents\Python + JS\pyTSA'))  # append library path to 
    from pyTSA import Dataset, Datasets, FirstOrderModel, FirstOrderLPLModel


fname = "HAP-3tBuTPA toluene degassed.txt"
# fname = "test.txt"
fname = os.path.join(os.path.dirname(__file__), fname)


def json2arr(base64_text: str) -> np.ndarray:
    bytes = base64.b64decode(base64_text)
    return np.frombuffer(bytes, dtype=np.float64)

def arr2json(arr: np.ndarray) -> str:
    # _arr = arr if arr.data.c_contiguous else arr.T
    # if not _arr.data.c_contiguous:
    #     _arr = np.ascontiguousarray(arr)
    b64 = base64.b64encode(arr)

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
        self.tabs = [Datasets()]
        self.app = app

        # d = Dataset.from_file(fname, transpose=True, delimiter='\t')
        # self.datasets.append(d)

    def clear(self):
        self.datasets.clear()
        self.tabs = [Datasets()]

    def add_dataset(self, index: int, tab_index: int):
        if (tab_index >= len(self.tabs)):
            for i in range(tab_index - len(self.tabs) + 1):
                self.tabs.append(Datasets())

        self.tabs[tab_index].append(self.datasets[index].copy(), key=index)

    def remove_dataset(self, index: int, tab_index: int):
        self.tabs[tab_index].remove(key=index)

    def perform_operation(self, op: str, tab_index: int, **kwargs):
        getattr(self.tabs[tab_index], op)(**kwargs)
        return self.get_datasets(self.tabs[tab_index])

    def transpose_dataset(self, index: int):
        self.datasets[index].transpose()

    def post_datasets(self, data: dict):
        ds: list = data['data']['datasets']

        for d in ds:
            mat, t, w = load_matrix(d)
            dataset = Dataset(mat, t, w, name=d['name'])
            self.datasets.append(dataset)

        return ""
    
    def get_datasets(self, datasets: Datasets):
        def _put_dataset(d: Dataset):
            obj = {
                'times': arr2json(d.times),
                'wavelengths': arr2json(d.wavelengths),
                'matrix': {
                    'data': arr2json(np.ascontiguousarray(d.matrix)),
                    'c_contiguous': True  #d.matrix.data.c_contiguous
                },
                'name': d.name
            }

            return obj

        data = {
            'data': {
                'datasets': [_put_dataset(d) for d in datasets]
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


