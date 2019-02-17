var express = require("express");
var bodyParser=require("body-parser");
var routes = require("./index.js");
var app=express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
routes(app);

var server = app.listen(3000, function () {
    console.log("Our app is listening on Port:", 3000);
})
