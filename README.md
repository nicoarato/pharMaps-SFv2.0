# pharMaps
App in ionic to find pharmacies with geolocation.


I am trying to create an ionic application where I can use my geolocation to find the nearest pharmacy.


To do this I spent time collecting the location of all the pharmacies in my city (Santa Fe - Argentina) and created a service.


Visit de project at [PharMaps](https://www.santafe-farmacias.com.ar).

## Publicación y actualización de turnos

Netlify está conectado a este repositorio y publica automáticamente los cambios
integrados a `master`. La configuración está en `netlify.toml`: Node 24.15.0,
`npm run build` en producción, salida `www` y funciones en `netlify/functions`.

El workflow de turnos consulta Santa Fe y Esperanza del día 1 al 5 de cada mes.
Propone actualizaciones en Pull Requests borrador; si Santa Fe presenta dudas,
adjunta las lecturas, alternativas y recortes para resolverlas antes de actualizar
los datos. Al integrar un PR con los JSON validados, Netlify compila y publica
la nueva versión. Verificar que el deploy termine correctamente en
[Netlify](https://app.netlify.com/projects/santafe-farmaciasv2/deploys).

También se puede ejecutar manualmente la consulta desde la pestaña Actions.
El procesamiento se documenta en `helpers/turnos-monitor/README.md`.


To work with maps, on this occasion I chose [Mapbox](https://www.mapbox.com).

<div>
<img src="https://github.com/nicoarato/pharMaps/blob/master/src/assets/farma-Pixel.png" width="31.3%" height="31.3%" />
<img src="https://github.com/nicoarato/pharMaps/blob/master/src/assets/farma-iPad.png" width="40%" height="40%" />
</div>
<img src="https://github.com/nicoarato/pharMaps/blob/master/src/assets/farma-MacbookAir.png" width="73%" height="73%" />
