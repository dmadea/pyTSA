from flask import Flask, jsonify, request, Response
import json
from flask_cors import CORS
from backend import get_data

app  = Flask(__name__)
CORS(app, resources={r'/*': {'origins': '*'}})
host, port = 'localhost', 6969


# @app.route('/api')
# def test():
#     return "Hello"


@app.route("/api/ping", methods=["GET"])
def ping():
    return jsonify('pong')

@app.route("/api/testpost", methods=["POST"])
def test():

    if request.method == "POST":
        received_data = request.get_json()
        print(f"received data: {received_data}")

        return_data = get_data()
        return Response(response=json.dumps(return_data), status=201)

if __name__ == '__main__':
    app.run(host, port)