from flask import Flask, request
# from flask_cors import CORS

app  = Flask(__name__)
# CORS(app)
host, port = 'localhost', 6969


@app.route('/', methods=["GET", "POST"])
def test():
    return "Hello"

if __name__ == '__main__':
    app.run(host, port)