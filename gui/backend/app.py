from flask import Flask, jsonify, request, Response
import json
from flask_cors import CORS
from backend import BackendSession

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
    return_data = session.get_datasets()
    return Response(response=json.dumps(return_data), status=200)



@app.route("/api/post_datasets", methods=["POST"])
def r_post_datasets():
    if request.method == "POST":
        received_data = request.get_json()
        return_data = session.post_datasets(received_data)
        return Response(response=json.dumps(return_data), status=201)


if __name__ == '__main__':
    app.run(host, port)