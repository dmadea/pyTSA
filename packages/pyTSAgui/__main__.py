from flask import Flask, jsonify, request, Response
import json
from flask_cors import CORS
from .backend import BackendSession

app  = Flask(__name__)
CORS(app, resources={r'/*': {'origins': '*'}})
host, port = 'localhost', 6969

session = BackendSession(app)


# @app.route('/api')
# def test():
#     return "Hello"


@app.route("/api/ping", methods=["GET"])
def ping():
    return Response(response=json.dumps("pong"), status=201)

@app.route("/api/get_datasets", methods=["GET"])
def r_get_datasets():
    return_data = session.get_datasets(session.datasets)
    return Response(response=json.dumps(return_data), status=201)


@app.route("/api/post_datasets", methods=["POST"])
def r_post_datasets():
    if request.method == "POST":
        received_data = request.get_json()
        return_data = session.post_datasets(received_data)
        return Response(response=json.dumps(return_data), status=201)


@app.route("/api/add_dataset/<index>/<tab_index>", methods=["POST"])
def r_add_dataset(index: str, tab_index: str):
    if request.method == "POST":
        session.add_dataset(int(index), int(tab_index))
        return Response(status=201)
    
@app.route("/api/remove_dataset/<index>/<tab_index>", methods=["POST"])
def r_remove_dataset(index: str, tab_index: str):
    if request.method == "POST":
        session.remove_dataset(int(index), int(tab_index))
        return Response(status=201)
    

@app.route("/api/perform/<operation>/<tab_index>", methods=["POST"])
def r_perform_operation(operation: str, tab_index: str):
    if request.method == "POST":
        received_data = request.get_json()
        return_data = session.perform_operation(operation, int(tab_index), **received_data)
        return Response(response=json.dumps(return_data), status=201)
    
@app.route("/api/update_model_options/<tab_index>", methods=["POST"])
def r_update_model_options(tab_index: str):
    if request.method == "POST":
        received_data = request.get_json()
        return_data = session.update_model_options(int(tab_index), **received_data)
        return Response(response=json.dumps(return_data), status=201)
    
@app.route("/api/estimate_chirp_params/<tab_index>", methods=["POST"])
def r_estimate_chirp_params(tab_index: str):
    if request.method == "POST":
        received_data = request.get_json()
        return_data = session.estimate_chirp_params(int(tab_index), **received_data)
        json_data = json.dumps(return_data)
        return Response(response=json_data, status=201)
    
@app.route("/api/update_model_param/<tab_index>", methods=["POST"])
def r_update_model_param(tab_index: str):
    if request.method == "POST":
        received_data = request.get_json()
        session.update_model_param(int(tab_index), received_data)
        return Response(status=201)

@app.route("/api/transpose_dataset/<index>", methods=["POST"])
def r_transpose(index: str):
    if request.method == "POST":
        session.transpose_dataset(int(index))
        return Response(status=201)
    
@app.route("/api/fit_model/<tab_index>", methods=["POST"])
def r_fit_model(tab_index: str):
    if request.method == "POST":
        return_data = session.fit_model(int(tab_index))
        return Response(response=json.dumps(return_data), status=201)
    
@app.route("/api/simulate_model/<tab_index>", methods=["POST"])
def r_simulate_model(tab_index: str):
    if request.method == "POST":
        return_data = session.simulate_model(int(tab_index))
        return Response(response=json.dumps(return_data), status=201)
    
@app.route("/api/set_model/<tab_index>/<model_name>", methods=["POST"])
def r_set_model(tab_index: str, model_name: str):
    if request.method == "POST":
        session.set_model(int(tab_index), model_name)
        return Response(status=201)
    
    
@app.route("/api/clear", methods=["POST"])
def r_clear():
    if request.method == "POST":
        session.clear()
        return Response(status=201)


if __name__ == '__main__':
    app.run(host, port)