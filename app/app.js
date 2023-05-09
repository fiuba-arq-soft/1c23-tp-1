import { nanoid } from "nanoid";
import express from "express";
import axios from "axios";
import { createClient } from "redis";
import { XMLParser } from "fast-xml-parser";
import { decode } from "metar-decoder";
import { StatsD } from "hot-shots";
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
    windowMs: 20*60*1000, //20 minutos
    max: 100,
    standarHeaders: true,
    legacyHeaders: false
})

const statsd_client = new StatsD({
  "port": "8125",
  "graphiteHost": "127.0.0.1",
  "flushInterval": 1000,
})

const app = express();
const redisClient = createClient({ url: "redis://redis:6379" });


const start_time = new Date();

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


app.get("/ping", apiLimiter, async (req, res) => {
  res.status(200).send("Todo ok");
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
      let start_api_fact = start_time.getTime()
      let facts_res = await axios.get(
        "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
      );
      let end_api_fact = start_time.getTime()
      statsd_client.timing("api.fact.timing", end_api_fact - start_api_fact);

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

app.get("/fact", apiLimiter, async (req, res) => {


  let start = start_time.getTime();

  let response_fact = await getFact();

  let message =
    response_fact.status == 200
      ? response_fact.res
      : response_fact.errorMessage;


  let end = start_time.getTime();
  let timeFact = start - end;
  
  statsd_client.timing('app.endpoint.fact', timeFact);
  
  
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
      let start_api_metar = start_time.getTime()
      let response = await axios.get(
        `https://www.aviationweather.gov/adds/dataserver_current/httpparam?dataSource=metars&requestType=retrieve&format=xml&stationString=${code_station}&hoursBeforeNow=1`
      );
      let end_api_metar = start_time.getTime();

      statsd_client.timing("api.metar.timing", end_api_metar - start_api_metar);

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

app.get("/metar", apiLimiter, async (req, res) => {

  let start = start_time.getTime();

  let response = await getMetarData(req);
  console.info(response);
  let message = response.status == 200 ? response.res : response.errorMessage;
  let end = start_time.getTime();
  let endpoint_timeMetar_response = start - end;


  statsd_client.timing("app.endpoint.metar.timing", endpoint_timeMetar_response);
  res.status(response.status).send(message);
});

/**
 * Get or set the titles of 5 articles
 * @returns {res: [], status: requestStatusCode, errorMessage: ""}
 */
async function getSpaceNews(){

  let spaces_news = redisClient.get("space_news");
  if (!spaces_news) {
    return { res: JSON.parse(spaces_news), status: 200, errorMessage: "" };
  }
  try {
    let start_api_space_news = start_time.getTime()
    const response = await axios.get('https://api.spaceflightnewsapi.net/v3/articles?_limit=5')
    let end_api_space_news = start_time.getTime();
    statsd_client.timing("api.space_news.timing", end_api_space_news - start_api_space_news);
    let titles = [];

    response.data.forEach(element => {
        if (element.hasOwnProperty('title')){
            titles.push(element.title);
        }
    });

    redisClient.set('space_news',JSON.stringify(titles),{EX:5}) 
    return {res: titles, status: 200, errorMessage: ""};
  } catch (error) {
    return {res: null, status: error.status, errorMessage: error.message};
  }
  
}

app.get('/space_news', apiLimiter, async (req,res) => {

  let start = start_time.getTime();
  let response = getSpaceNews();
  let end = start_time.getTime();
  let endpoint_time_space_news = start - end;
  let message = response.res ?? res.errorMessage;
  statsd_client.timing("app.endpoint.space_news.timing", endpoint_time_space_news);
  req.status(response.status).send(message);
  
});


app.listen(3000);

