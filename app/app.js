import { nanoid } from "nanoid";
import express from "express";
import axios from "axios";
import { createClient } from "redis";
import { XMLParser } from "fast-xml-parser";
import { decode } from "metar-decoder";
import { StatsD } from "hot-shots";

const statsd_client = new StatsD({
  host: "graphite",
  port: 8125,
});

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

/**
 * Returns a constant to check App's status
 */
app.get("/ping", async (req, res) => {
  res.status(200).send("Todo ok");
});

/**
 * Gets or set random fact information
 * @returns
 */
async function getFact() {
  let fact_string = await redisClient.get("fact");
  if (fact_string !== null) {
    console.log(`get fact id: ${fact_string}`);
    return { res: JSON.parse(fact_string), status: 200, error_message: "" };
  } else {
    try {
      let start_api_fact = start_time.getTime();
      let facts_res = await axios.get(
        "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
      );
      let end_api_fact = start_time.getTime();
      statsd_client.timing("api.fact.timing", end_api_fact - start_api_fact);

      const facts_info = facts_res.data;
      let fact = facts_info.text;
      await redisClient
        .set("fact", JSON.stringify(fact), { EX: 15 })
        .then(() => {
          console.log(`Se llamo y se Cached fact id: ${facts_info.id}`);
        });
      return { res: fact, status: 200, error_message: "" };
    } catch (err) {
      return { res: null, status: err.status, error_message: err.message };
    }
  }
}

app.get("/fact", async (req, res) => {
  let start = start_time.getTime();

  let response_fact = await getFact();

  let message =
    response_fact.status == 200
      ? response_fact.res
      : response_fact.error_message;

  let end = start_time.getTime();
  let time_fact = start - end;

  statsd_client.timing("app.endpoint.fact.timing", time_fact);

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
    return { res: JSON.parse(metar_string), status: 200, error_message: "" };
  } else {
    const parser = new XMLParser();
    try {
      let start_api_metar = start_time.getTime();
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
          .set(metar_key, JSON.stringify(response_message), { EX: 5 })
          .then(() => {
            console.log(`Station ${code_station} cached`);
          });
        return {
          res: response_message,
          status: 200,
          error_message: "",
        };
      } else {
        return {
          res: null,
          status: 404,
          error_message: `Metar no encontro información sobre la estación: ${code_station}`,
        };
      }
    } catch (err) {
      return { res: null, status: err.status, error_message: err.message };
    }
  }
}

app.get("/metar", async (req, res) => {
  let start = start_time.getTime();

  let response = await getMetarData(req);
  console.info(response);
  let message = response.status == 200 ? response.res : response.error_message;
  let end = start_time.getTime();
  let endpoint_time_metar_response = start - end;

  statsd_client.timing(
    "app.endpoint.metar.timing",
    endpoint_time_metar_response
  );
  res.status(response.status).send(message);
});

/**
 * Get or set the titles of 5 articles
 * @returns {res: [], status: requestStatusCode, error_message: ""}
 */
async function getSpaceNews() {
  let spaces_news = redisClient.get(`space_news`);
  if (!spaces_news) {
    console.log(`Cached fact id: ${spaces_news}`);
    return { res: JSON.parse(spaces_news), status: 200, error_message: "" };
  }
  try {
    let start_api_space_news = start_time.getTime();
    const response = await axios.get(
      "https://api.spaceflightnewsapi.net/v3/articles?_limit=5"
    );
    let end_api_space_news = start_time.getTime();
    statsd_client.timing(
      "api.space_news.timing",
      end_api_space_news - start_api_space_news
    );
    let titles = [];

    response.data.forEach((element) => {
      if (element.hasOwnProperty("title")) {
        titles.push(element.title);
      }
    });

    await redisClient
      .set(`space_news`, JSON.stringify(titles), { EX: 5 })
      .then(() => {
        console.info(`se cachearon los titulos ${titles}`);
      });
    return { res: titles, status: 200, error_message: "" };
  } catch (error) {
    return { res: null, status: error.status, error_message: error.message };
  }
}

app.get("/space_news", async (req, res) => {
  let start = start_time.getTime();
  let response = await getSpaceNews();
  let end = start_time.getTime();
  let endpoint_time_space_news = start - end;
  let message = response.res ?? res.error_message;
  statsd_client.timing(
    "app.endpoint.space_news.timing",
    endpoint_time_space_news
  );
  res.status(response.status).send(message);
});

app.listen(3000);
