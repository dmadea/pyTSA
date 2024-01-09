from flask import Flask, request, render_template
# from flask_cors import CORS

app  = Flask(__name__)
# CORS(app)
host, port = 'localhost', 6969


@app.route('/')
def test():
    return render_template("index.html")

if __name__ == '__main__':
    app.run(host, port)