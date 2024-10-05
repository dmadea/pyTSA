
import sys, os

import numpy as np
import base64
try:
    from pyTSA import Dataset, Datasets, FirstOrderModel, FirstOrderLPLModel, DelayedFluorescenceModel
except ImportError:
    if sys.platform == 'darwin':
        sys.path.append(os.path.abspath("/Users/dominikmadea/Documents/Python + JS/pyTSA"))
    else:
        sys.path.append(os.path.abspath(r'C:\Users\domin\Documents\Python + JS\pyTSA'))  # append library path to 
    from pyTSA import Dataset, Datasets, FirstOrderModel, FirstOrderLPLModel, DelayedFluorescenceModel

from lmfit import Parameters, Parameter

fname = "HAP-3tBuTPA toluene degassed.txt"
# fname = "test.txt"
fname = os.path.join(os.path.dirname(__file__), fname)


def json2arr(base64_text: str) -> np.ndarray:
    bytes = base64.b64decode(base64_text)
    return np.frombuffer(bytes, dtype=np.float64)

def arr2json(arr: np.ndarray) -> str:
    b64 = base64.b64encode(arr)
    return b64.decode('utf-8')

def parse_dataset_data(dataset: dict):
    t = json2arr(dataset['times'])
    w = json2arr(dataset['wavelengths'])
    mat = parse_matrix_data(dataset['matrix'])
    return mat, t, w

def parse_matrix_data(obj: dict) -> np.ndarray:
    mat = json2arr(obj['data'])
    c_contiguous = obj['c_contiguous']
    mat = mat.reshape((obj['nrows'], obj['ncols']) if c_contiguous else (obj['ncols'], obj['nrows'])) 
    mat = mat if c_contiguous else mat.T
    return mat

def put_matrix_data(arr: np.ndarray):
    return dict(data=arr2json(np.ascontiguousarray(arr)), c_contiguous=True, nrows=arr.shape[0], ncols=arr.shape[1])

# export interface IFitData {
#   matrices: {
#     CfitDAS: IMatrixData,
#     STfitDAS: IMatrixData,
#     CfitEAS?: IMatrixData,
#     STfitEAS?: IMatrixData,
#     Dfit: IMatrixData,
#     LDM?: IMatrixData,
#     Cartifacts?: IMatrixData,
#     STartifacts?: IMatrixData,
#   },
#   params: IParam[],
#   chirpData?: string
# }

# interface IMatrixData {
#   data: string,
#   c_contiguous: boolean,
#   nrows: number,
#   ncols: number
# }

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

    def _append_tabs(self, tab_index):
        if (tab_index >= len(self.tabs)):
            for i in range(tab_index - len(self.tabs) + 1):
                self.tabs.append(Datasets())

    def add_dataset(self, index: int, tab_index: int):
        self._append_tabs(tab_index)
        ds = self.tabs[tab_index]
        ds.append(self.datasets[index].copy(), key=index)
        ds.set_model(ds.model) # sets the model for the first dataset

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
            mat, t, w = parse_dataset_data(d)
            dataset = Dataset(mat, t, w, name=d['name'])
            self.datasets.append(dataset)

        return ""
    
    def get_datasets(self, datasets: Datasets):
        def _put_dataset(d: Dataset):
            obj = {
                'times': arr2json(d.times),
                'wavelengths': arr2json(d.wavelengths),
                'matrix': put_matrix_data(d.matrix),
                'name': d.name
            }

            return obj

        data = {
            'data': {
                'datasets': [_put_dataset(d) for d in datasets]
            }
        }

        return data
    
    def set_model(self, tab_index: int, model_name: str):
        self._append_tabs(tab_index)

        model_map = {
            'first_order': FirstOrderModel,
            'first_order_lpl': FirstOrderLPLModel,
            'delayed_fl': DelayedFluorescenceModel
        }

        self.tabs[tab_index].set_model(model_map[model_name]())
    
    def _get_fit_params(self, params: Parameters) -> dict:
        def _put_param(p: Parameter):
            obj = {
                'name': p.name,
                'min': str(p.min),
                'max': str(p.max),
                'value': p.value,
                'error': p.stderr,
                'fixed': not p.vary
            }

            return obj

        return dict(params=[_put_param(par) for key, par in params.items()])

    
    def update_model_options(self, tab_index: int, **options):
        self._append_tabs(tab_index)
        model = self.tabs[tab_index].model

        model.update_options(**options)
        return self._get_fit_params(model.params)
    
    def estimate_chirp_params(self, tab_index: int, **data):
        model = self.tabs[tab_index].model
        model.estimate_chirp(data['x'], data['y'])
        return self._get_fit_params(model.params)

    def update_model_param(self, tab_index: int, param_data: dict):
        self._append_tabs(tab_index)
        
        model = self.tabs[tab_index].model
        name = param_data['name']
        model.params[name].min = float(param_data['min'])
        model.params[name].max = float(param_data['max'])
        model.params[name].value = float(param_data['value'])
        model.params[name].vary = not param_data['fixed']

    def _put_fit_matrices(self, model: FirstOrderModel):
        # export interface IFitData {
        #   matrices: {
        #     CfitDAS: IMatrixData,
        #     STfitDAS: IMatrixData,
        #     CfitEAS?: IMatrixData,
        #     STfitEAS?: IMatrixData,
        #     Dfit: IMatrixData,
        #     LDM?: IMatrixData,
        #     Cartifacts?: IMatrixData,
        #     STartifacts?: IMatrixData,
        #   },
        #   params: IParam[],
        #   chirpData?: string
        # }
        # print(model.C_opt.shape, model.ST_opt.shape, model.matrix_opt.shape)
        data = dict(CfitDAS=put_matrix_data(model.C_opt if model.C_opt.ndim == 2 else model.C_opt[0]), 
                    STfitDAS=put_matrix_data(model.ST_opt),
                    Dfit=put_matrix_data(model.matrix_opt))
        
        if model.C_EAS is not None:
            data.update(dict(CfitEAS=put_matrix_data(model.C_EAS if model.C_EAS.ndim == 2 else model.C_EAS[0])))

        if model.ST_EAS is not None:
            data.update(dict(STfitEAS=put_matrix_data(model.ST_EAS)))

        if model.C_artifacts is not None:
            data.update(dict(Cartifacts=put_matrix_data(model.C_artifacts if model.C_artifacts.ndim == 2 else model.C_artifacts[0])))

        if model.ST_artifacts is not None:
            data.update(dict(STartifacts=put_matrix_data(model.ST_artifacts)))

        # print(model.C_artifacts, model.ST_artifacts)

        return dict(matrices=data, chirpData=arr2json(model.get_actual_chirp_data()))

    def fit_model(self, tab_index: int):
        if self.tabs[tab_index].model.dataset is None:
            return self._get_fit_params(self.tabs[tab_index].model.params)
        
        m = self.tabs[tab_index].model
        m.fit()

        data: dict = self._put_fit_matrices(m)
        data.update(self._get_fit_params(m.params))

        return data
    
    def simulate_model(self, tab_index: int):
        if self.tabs[tab_index].model.dataset is None:
            return self._get_fit_params(self.tabs[tab_index].model.params)
        
        m = self.tabs[tab_index].model
        m.simulate()

        return self._put_fit_matrices(m)


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


