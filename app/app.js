import { nanoid } from "nanoid";

import express from "express";

import axios from "axios";

import { createClient } from "redis";

import { XMLParser } from "fast-xml-parser";
import { decode } from "metar-decoder";

/* 

const rateLimit = require('express-rate-limit')

const { decode } = require('metar-decoder');

const apiLimiter = rateLimit({
    windowMs: 20*60*1000, //20 minutos
    max: 100,
    standarHeaders: true,
    legacyHeaders: false
})
  */

const app = express();
const redisClient = createClient({ url: "redis://redis:6379" });

(async () => {
  await redisClient.connect();
})();

process.on("SIGTERM", async () => {
  try {
    await redisClient.quit();
  } catch (e) {}
});

const id = nanoid();

app.use((req, res, next) => {
  res.setHeader("X-API-Id", id);
  next();
});

app.get("/", async (req, res) => {
  res.status(200).send("ping");
});

/**
 * Gets or set random fact information
 * @returns
 */
async function getFact() {
  let fact_string = await redisClient.get("fact");

  if (fact_string !== null) {
    return JSON.parse(fact_string);
  } else {
    try {
      let facts_res = await axios.get(
        "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
      );
      const facts_info = facts_res.data;
      let fact = facts_info.text;
      redisClient.set("fact", JSON.stringify(fact), { EX: 60 }).then(() => {
        console.log(`Cached fact id: ${facts_info.id}`);
      });
      return { res: fact, status: 200, errorMessage: "" };
    } catch (err) {
      return { res: null, status: err.status, errorMessage: err.message };
    }
  }
}

app.get("/fact", async (req, res) => {
  let response_fact = await getFact();

  let message =
    response_fact.status == 200
      ? response_fact.res
      : response_fact.errorMessage;
  res.status(response_fact.status).send(message);
});

/**
 * Gets or set the station's metar information
 * @param {string} station
 * @returns
 */
async function getMetarData(req) {
  let response_message;
  const code_station = req.query.station;
  let metar_key = `metar_${code_station ?? "no_param"}_key`;
  let metar_string = await redisClient.get(metar_key);
  if (metar_string !== null) {
    return { res: JSON.parse(metar_string), status: 200, errorMessage: "" };
  } else {
    const parser = new XMLParser();
    try {
      let response = await axios.get(
        `https://www.aviationweather.gov/adds/dataserver_current/httpparam?dataSource=metars&requestType=retrieve&format=xml&stationString=${code_station}&hoursBeforeNow=1`
      );

      const parsed = parser.parse(response.data);

      if (parsed.response.data.hasOwnProperty("METAR")) {
        const metar_info = parsed.response.data.METAR;
        if (metar_info.hasOwnProperty("raw_text")) {
          response_message = decode(metar_info.raw_text);
        } else {
          response_message = metar_info.map((info) => decode(info.raw_text));
        }
        redisClient
          .set(metar_key, JSON.stringify(response_message), { EX: 20 })
          .then(() => {
            console.log(`Station ${code_station} cached`);
          });
        return {
          res: response_message,
          status: 200,
          errorMessage: "",
        };
      } else {
        return {
          res: null,
          status: 404,
          errorMessage: `Metar no encontro información sobre la estación: ${code_station}`,
        };
      }
    } catch (err) {
      return { res: null, status: err.status, errorMessage: err.message };
    }
  }
}

app.get("/metar", async (req, res) => {
  let response = await getMetarData(req);
  console.info(response);
  let message = response.status == 200 ? response.res : response.errorMessage;
  res.status(response.status).send(message);
});

app.listen(3000);
