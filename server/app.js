const path = require("path");
require("dotenv").config();
const routes = require(path.join(__dirname, './controllers'));
const express = require("express");
let app = express();


app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/dist")));
app.use(express.json())
app.get("/qa/questions", (req, res) => {
  console.log(req.query)
  routes.getQuestions(req, res);

});

app.get("/qa/questions/:question_id/answers", (req, res) => {

  routes.getAnswers(req, res);
});

app.post("/qa/questions", (req, res) => {
  routes.postQuestions(req, res);
});

app.post("/qa/questions/:question_id/answers", (req, res) => {
  routes.postAnswers(req, res);
});

app.put("/qa/questions/:question_id/helpful", (req, res) => {
  routes.putQuestionHelpful(req,res);
});

app.put("/qa/questions/:question_id/report", (req, res) => {
  routes.putQuestionReport(req,res);
});

app.put("/qa/answers/:answer_id/helpful", (req, res) => {
  routes.putAnswerHelpful(req,res);
});

app.put("/qa/answers/:answer_id/report", (req, res) => {
  routes.putAnswerReport(req,res);
});

app.listen(process.env.APIPort);
console.log(`Listening at http://localhost:${process.env.APIPort}`);
