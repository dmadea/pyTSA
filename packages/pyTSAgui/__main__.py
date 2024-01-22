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
    return jsonify('pong')


# @app.route("/api/testpost", methods=["POST"])
# def test():

#     if request.method == "POST":
#         received_data = request.get_json()
#         print(f"received data: {received_data}")

#         return_data = get_data()
#         return Response(response=json.dumps(return_data), status=201)


@app.route("/api/get_datasets", methods=["GET"])
def r_get_datasets():
    return_data = session.get_datasets(session.datasets)
    return Response(response=json.dumps(return_data), status=200)


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

@app.route("/api/transpose_dataset/<index>", methods=["POST"])
def r_transpose(index: str):
    if request.method == "POST":
        session.transpose_dataset(int(index))
        return Response(status=201)
    
@app.route("/api/clear", methods=["POST"])
def r_clear():
    if request.method == "POST":
        session.clear()
        return Response(status=201)


if __name__ == '__main__':
    app.run(host, port)