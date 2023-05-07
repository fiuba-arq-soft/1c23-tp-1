//const {nanoid } = require('nanoid');
import {nanoid} from 'nanoid';

import express from 'express';
//const express = require('express')

import axios from 'axios';
//const axios = require('axios');

//import { CreateClient } from 'redis';
/* const { createClient } = require('redis');

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
/* const redisClient = createClient({url: 'redis://redis:6379'});
 */
/* (async () => {
    await redisClient.connect();
})(); */

/* process.on('SIGTERM',async() => {
    try {
        await redisClient.quit();
    } catch(e) {

    }
}); */

const id = nanoid();

app.use((req, res, next) => {
    res.setHeader('X-API-Id', id);
    next();
})

    //console.log("entre");

app.get('/', async (req,res) => {
    res.status(200).send("ping");
});


/* app.get('/space_news', apiLimiter, async (req,res) => {
    let titles;
    try {
    const titlesString = await redisClient.get('space_news');
    
    if (titlesString != NULL){
        titles = JSON.parse(titlesString);
    } else {
        
        const response = await axios.get('https://api.spaceflightnewsapi.net/v3/articles?_limit=5')
        titles = [];

        response.data.forEach(element => {
            if (element.hasOwnProperty('title')){
                titles.push(element.title);
            }
            
        });

        await redisClient.set('space_news',JSON.stringify(titles),{EX:5}
        );
    }
    } catch(e) {

    }
    res.status(200).send(titles);
});
 */

app.get('/space_news', async (req,res) => {
 
    const response = await axios.get('https://api.spaceflightnewsapi.net/v3/articles?_limit=5')
    let titles = [];

    response.data.forEach(element => {
        if (element.hasOwnProperty('title')){
            titles.push(element.title);
        }
        
    });

    //await redisClient.set('space_news',JSON.stringify(titles),{EX:5}
    res.status(200).send(titles);
});

/*
app.get('/fact', apiLimiter, async (req, res) => {

    let fact;
    try{
        const factString = await redisClient.get('fact');
        
        if (factString !== NULL){
            fact = JSON.parse(factString);
        } else {
            const fact = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');

            await redisClient.set('fact',JSON.stringify(fact),{EX:5}
            );
        }
    } catch(e) {

    }
    res.status(200).send(fact);
  });


app.get('/ping', (req, res) => {
    res.status(200).send("pong");
});


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