// server.js
// where your node app starts

// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express");
const app = express();
var OpenTok = require('opentok');

var apikey="";
var secret="";
var sessionid="";
var opentok = OpenTok(apikey,secret)

app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/filter", (request, response) => {
  response.sendFile(__dirname + "/views/filter.html");
});

app.get("/token", (request, response) => {
  var token = opentok.generateToken(sessionid);
  response.json({"apikey":apikey,"sessionid":sessionid,"token":token});
});

// listen for requests :)
const listener = app.listen(8026, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
