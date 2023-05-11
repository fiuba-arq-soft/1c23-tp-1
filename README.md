# Trabajo practico 1 

## Objetivo

Implementar un servicio HTTP en Node.js-Express que represente una API que consume otras APIs para dar información a sus usuarios, similar a lo que brindaría una API para una página de inicio personalizada. Someter sus endpoints a diversas intensidades/escenarios de carga en algunas configuraciones de deployment, tomar mediciones y analizar resultados.


`agregar como correr el codigo` ?


### Servicios:

- `/ping`: Este servicio devolverá un valor constante, sin procesamiento. Lo utilizaremos como healthcheck y como baseline para comparar con los demás.

- `/metar?station=<code>`: Es un reporte del estado meteorológico que se registra en un aeródromo. Se lo codifica en un string.

- `/space_news`: Devolveremos solo los títulos de las 5 últimas noticias sobre actividad espacial

- `/fact`: Devolveremos 1 hecho sin utilidad por cada invocación a nuestro endpoint, obtenido desde uselessfacts.

### Performace 

Para poder analizar la performace de nuestro programa, se uso Artillery como generador de cargas. Dividiendo las fases en estos pasos. `START` en donde se envian 3 request por segundo durante un periodo de de 30, `FIRSTRAMP` en donde aumentamos los request por segundo en un periodo de 15,  `PLAIN` en donde mantenemos el ritmo de request que se llego en la fase anterior por unos 40 segundos, `RAMPDOWN` en donde empezamos a bajar la cantidad hasta que los request sean 3/s y por ultimo `REST` en donde frenamos las solicitudes por 15 segundos mas.



## Ping

Como especificamos anteriormente, es un simple healthcheck por lo que se espera un tiempo de respuesta bajo como asi tambien su uso recursos.



![](files/spaceNews/artillery.png)



"targets": [
        {
          "datasource": {
            "type": "graphite",
            "uid": "hLgr4MU4z"
          },
          "refCount": 0,
          "refId": "A",
          "target": "alias(color(sumSeries(stats.timers.app.endpoint.fact.timing.*), \"red\"), \"fact\")",
          "textEditor": true
        },
        {
          "datasource": {
            "type": "graphite",
            "uid": "hLgr4MU4z"
          },
          "hide": false,
          "refCount": 0,
          "refId": "B",
          "target": "alias(color(sumSeries(stats.timers.app.endpoint.space_news.timing.*), \"red\"), \"space-news\")",
          "textEditor": true
        },
        {
          "datasource": {
            "type": "graphite",
            "uid": "hLgr4MU4z"
          },
          "hide": false,
          "refCount": 0,
          "refId": "C",
          "target": "alias(color(sumSeries(stats.timers.app.endpoint.metar.timing.*), \"red\"), \"metar\")",
          "textEditor": true
        }
      ],