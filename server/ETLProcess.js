const { Pool } = require("pg");
require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

var finishCount = 0;

const pool = new Pool({
  user: process.env.ExistUser,
  host: process.env.Host,
  database: process.env.ExistDatabase,
  password: process.env.Password,
  port: process.env.Port,
});

async function createDatabase() {
  try {
    const client = await pool.connect();

    const databaseExistsQuery = `SELECT datname FROM pg_database WHERE datname = '${process.env.Database}'`;
    const databaseExistsResult = await client.query(databaseExistsQuery);

    if (databaseExistsResult.rows.length === 0) {
      await client.query(`CREATE DATABASE  ${process.env.Database}`);
      console.log(
        `New database (${process.env.Database}) created successfully!`
      );
    } else {
      console.log(
        `Database '${process.env.Database}' already exists, creating schema...`
      );
    }

    client.release();
  } catch (error) {
    console.error("Error occurred: ", error);
  } finally {
    createSchema();
  }
}

async function createSchema() {
  try {
    const newPool = new Pool({
      user: process.env.User,
      host: process.env.Host,
      database: process.env.Database,
      password: process.env.Password,
      port: process.env.Port,
    });

    const client = await newPool.connect();

    const schemaExistsQuery = `
      SELECT 1
      FROM information_schema.schemata
      WHERE schema_name = '${process.env.Schema}'
    `;

    const schemaExistsResult = await client.query(schemaExistsQuery);

    if (schemaExistsResult.rows.length === 0) {
      await client.query(`CREATE SCHEMA ${process.env.Schema}`);

      console.log(`New schema (${process.env.Schema}) created successfully`);
    } else {
      console.log(
        `Schema '${process.env.Schema}' already exists, creating tables...`
      );
    }

    const createQuestionsListTableQuery = `CREATE TABLE IF NOT EXISTS ${process.env.Schema}.questions_list (
      question_id SERIAL PRIMARY KEY,
      product_id integer,
      question_body varchar(1000),
      question_date varchar(25) DEFAULT CURRENT_TIMESTAMP,
      asker_name varchar(60),
      asker_email varchar(320),

      reported boolean DEFAULT FALSE,
      question_helpfulness integer

    )`;
    const createAnswersListTableQuery = `CREATE TABLE IF NOT EXISTS ${process.env.Schema}.answers_list (
      answer_id SERIAL PRIMARY KEY,
      question_id integer,

      answer_body varchar(1000),
      answer_date varchar(25) DEFAULT CURRENT_TIMESTAMP,
      answerer_name varchar(60),
      answerer_email varchar(320),
      reported boolean DEFAULT FALSE,
      helpfulness integer,
      FOREIGN KEY (question_id) REFERENCES ${process.env.Schema}.questions_list (question_id)
    )`;

    const createAnswersPhotosTableQuery = `CREATE TABLE IF NOT EXISTS ${process.env.Schema}.answers_photos (
      photo_id SERIAL PRIMARY KEY,
      answer_id integer,
      url varchar(2048),
      FOREIGN KEY (answer_id) REFERENCES ${process.env.Schema}.answers_list (answer_id)
    )`;

    await client.query(
      `DROP TABLE IF EXISTS ${process.env.Schema}.questions_list, ${process.env.Schema}.answers_list, ${process.env.Schema}.answers_photos`,
      async (err) => {
        if (err) console.error("err occured when dropping tables: ", err);
        else {
          await client.query(createQuestionsListTableQuery, async (err) => {
            if (err)
              console.error(
                "err occured when creating TABLE (questions_list): ", err);
            else {
              console.log("questions_list created");

              let createQuesntionsListIndex =`CREATE INDEX idx_product_id
              ON ${process.env.Schema}.questions_list (product_id)`
              client.query(createQuesntionsListIndex, async(err) => {
                if (err)
              console.error(
                "err occured when creating TABLE TABLE INDEX (questions_list): ", err);
                transformQuestionsData();

              })


            }
          });
          await client.query(createAnswersListTableQuery, async (err) => {
            if (err)
              console.error(
                "err occured when creating TABLE INDEX TABLE (answers_list): ",
                err
              );
            else {
              console.log("answers_list created");
              let createAnswersListIndex =`CREATE INDEX idx_question_id
              ON ${process.env.Schema}.answers_list (question_id)`

              client.query(createAnswersListIndex, async(err) => {
                if (err)
              console.error(
                "err occured when creating TABLE INDEX (answers_list): ", err);
                transformAnswersData();

              })


            }
          });
          await client.query(createAnswersPhotosTableQuery, async (err) => {
            if (err)
              console.error(
                "err occured when creating TABLE (answers_photos): ",
                err
              );
            else {
              let createAnswersPhotosIndex =`CREATE INDEX idx_answer_id
              ON ${process.env.Schema}.answers_photos (answer_id)`

              client.query(createAnswersPhotosIndex, async(err) => {
                if (err) console.error("err occured when creating TABLE INDEX TABLE (answers_photos): ", err);
                console.log("answers_photos created");
                transformAnswersPhotosData();

              })


            }
          });
        }
      }
    );

    client.release();
  } catch (error) {
    console.error("Error occurred: ", error);
  } finally {
    pool.end();
  }
}

async function loadingData() {
  try {
    console.log("All data transformed, start loading data into tables...");
    const newPool = new Pool({
      user: process.env.User,
      host: process.env.Host,
      database: process.env.Database,
      password: process.env.Password,
      port: process.env.Port,
    });

    const client = await newPool.connect();

    //load data to questions list
    console.log(
      `Extracting from ${path.join(
        __dirname,
        "./../csv/tempQuestions.csv"
      )} ...`
    );
    var startTime = performance.now();
    await client.query("BEGIN");

    var tableName = `${process.env.Schema}.questions_list`;
    var filePath = path.join(__dirname, "./../csv/tempQuestions.csv");

    var copyCommand = `COPY ${tableName} FROM '${filePath}' DELIMITER ',' CSV`;

    await client.query(copyCommand);

    await client.query("COMMIT");
    var endTime = performance.now();
    var time = ((endTime - startTime) / 1000).toFixed(3);
    console.log(`Data loaded to questions_list, time used: ${time} seconds`);

    //load data to answers list
    console.log(
      `Extracting from ${path.join(__dirname, "./../csv/tempAnswers.csv")} ...`
    );
    startTime = performance.now();
    await client.query("BEGIN");

    tableName = `${process.env.Schema}.answers_list`;
    filePath = path.join(__dirname, "./../csv/tempAnswers.csv");

    copyCommand = `COPY ${tableName} FROM '${filePath}' DELIMITER ',' CSV`;

    await client.query(copyCommand);

    await client.query("COMMIT");
    endTime = performance.now();
    time = ((endTime - startTime) / 1000).toFixed(3);
    console.log(`Data loaded to answers_list, time used: ${time} seconds`);

    //load data to answers photos
    console.log(
      `Extracting from ${path.join(
        __dirname,
        "./../csv/tempAnswers_photos.csv"
      )} ...`
    );
    startTime = performance.now();
    await client.query("BEGIN");

    tableName = `${process.env.Schema}.answers_photos`;
    filePath = path.join(__dirname, "./../csv/tempAnswers_photos.csv");

    copyCommand = `COPY ${tableName} FROM '${filePath}' DELIMITER ',' CSV`;

    await client.query(copyCommand);

    await client.query("COMMIT");
    endTime = performance.now();
    time = ((endTime - startTime) / 1000).toFixed(3);
    console.log(`Data loaded to answers_photos, time used: ${time} seconds`);

    client.release();
  } catch (error) {
    console.error("Error occurred: ", error);
  } finally {
    console.log("All data loaded!");

    fs.unlink(path.join(__dirname, "./../csv/tempQuestions.csv"), (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return;
      }
    });
    fs.unlink(path.join(__dirname, "./../csv/tempAnswers.csv"), (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return;
      }
    });
    fs.unlink(
      path.join(__dirname, "./../csv/tempAnswers_photos.csv"),
      (err) => {
        if (err) {
          console.error("Error deleting file:", err);
          return;
        }
      }
    );
    console.log("All temp files deleted!");
  }
}

async function transformQuestionsData() {
  const fromPath = path.join(__dirname, "./../csv/questions.csv");
  const toPath = path.join(__dirname, "./../csv/tempQuestions.csv");

  console.log("questions transforming...");

  if (fs.existsSync(toPath)) {
    fs.unlink(toPath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return;
      }
    });
  }

  fs.writeFileSync(toPath, "");

  const writeStream = fs.createWriteStream(toPath, { flag: "a" });

  fs.createReadStream(fromPath)
    .pipe(csv())
    .on("data", (data) => {
      let time = new Date(parseInt(data.date_written)).toISOString();
      data.date_written = time;
      writeStream.write(
        `${data.id},${data.product_id},"${data.body}","${data.date_written}","${data.asker_name}","${data.asker_email}",${data.reported},${data.helpful}\n`
      );
    })
    .on("end", async () => {
      console.log(`Data transformed, location: ${toPath}`);

      finishCount++;
      if (finishCount === 3) {
        await loadingData();
      }
    });
}

async function transformAnswersData() {
  const fromPath = path.join(__dirname, "./../csv/answers.csv");
  const toPath = path.join(__dirname, "./../csv/tempAnswers.csv");
  console.log("answers transforming...");
  if (fs.existsSync(toPath)) {
    fs.unlink(toPath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return;
      }
    });
  }
  fs.writeFileSync(toPath, "");

  const writeStream = fs.createWriteStream(toPath, { flag: "a" });

  fs.createReadStream(fromPath)
    .pipe(csv())
    .on("data", (data) => {
      let time = new Date(parseInt(data.date_written)).toISOString();
      data.date_written = time;

      writeStream.write(
        `${data.id},${data.question_id},"${data.body}","${data.date_written}","${data.answerer_name}","${data.answerer_email}",${data.reported},${data.helpful}\n`
      );
    })
    .on("end", async () => {
      console.log(`Answers data transformed, location: ${toPath}`);

      finishCount++;
      if (finishCount === 3) {
        await loadingData();
      }
    });
}

async function transformAnswersPhotosData() {
  const fromPath = path.join(__dirname, "./../csv/answers_photos.csv");
  const toPath = path.join(__dirname, "./../csv/tempAnswers_photos.csv");
  console.log("answers photos transforming...");
  if (fs.existsSync(toPath)) {
    fs.unlink(toPath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return;
      }
    });
  }
  fs.writeFileSync(toPath, "");

  const writeStream = fs.createWriteStream(toPath, { flag: "a" });

  fs.createReadStream(fromPath)
    .pipe(csv())
    .on("data", (data) => {
      writeStream.write(`${data.id},${data.answer_id},"${data.url}"\n`);
    })
    .on("end", async () => {
      console.log(`Answers photos data transformed, location: ${toPath}`);

      finishCount++;
      if (finishCount === 3) {
        await loadingData();
      }
    });
}

createDatabase();
