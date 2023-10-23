from flask import Flask
from flask_cors import CORS

app  = Flask(__name__)
CORS(app)
host, port = 'localhost', 6969


@app.route('/')
def test():
    return "pasokdpaosdpaosdkap"

if __name__ == '__main__':
    app.run(host, port)