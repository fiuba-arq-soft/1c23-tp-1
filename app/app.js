import { nanoid } from "nanoid";

import express from "express";

import axios from "axios";

import { createClient } from "redis";

/* 
const rateLimit = require('express-rate-limit')

const { XMLParser } = require('fast-xml-parser');
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

async function getFacts() {
  const factString = await redisClient.get("fact");
  if (factString !== NULL) {
    return {res: JSON.parse(factString), status:200, errorMessage:""};
  } else {
    try {
      const factRes = await axios.get(
        "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
      );
      redisClient.set("fact", JSON.stringify(factRes.text), { EX: 15 });
      return { res: fact, status: 200, errorMessage:"" };

    } catch (error) {
      return {
        res: null,
        status: error.status,
        errorMessage: error.message,
      };
    }
  }
}

app.get("/fact", apiLimiter, async (req, res) => {

  const factString = await getFacts();

  let response = factString.status !== 200 ? factString.errorMessage : factString.res

  res.status(factString.status).send(response);
});

/*
app.get('/metar', apiLimiter, async (req,res) => {

    let station = req.query.station;
    let metar;
    let metarKey = `metar_${station}_key`;
try {
    let metarString = await redisClient.get(metarKey);

    if (metarString !==  NULL){
        metar = JSON.parse(metarString);
    } else {
        
        const parser = new XMLParser();
        
        
            const response = await axios.get(`https://www.aviationweather.gov/adds/dataserver_current/httpparam?dataSource=metars&requestType=retrieve&format=xml&stationString=${station}&hoursBeforeNow=1`);

            if (!response.data) {
                req.send(500).send(`No hay respuesta del servidor sobre la estacion: ${station}`);
            }
            
            const parsed = parser.parse(response.data);

            if (!parser.response.data.METAR) {
                req.send(404).send(`No hay información sobre la estacion: ${station}`);
            }

            metar = decode(parsed.response.data.METAR.raw_text);

            await redisClient.set(metarKey,JSON.stringify(metar),{EX:5});
            req.send(200).send(metar);
    }
    } catch(e) {
        req.send(404).send("");
    }

    

}); */

app.listen(3000);
