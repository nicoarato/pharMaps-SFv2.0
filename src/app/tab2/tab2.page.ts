import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { environment } from '../../environments/environment.prod';
import * as Mapboxgl from 'mapbox-gl';
import { FarmaciasService } from '../services/farmacias.service';
import {
  FarmaciaGeojson,
  FarmaciaMapaFeatureCollection,
  TurnoActivo,
  TurnoProgramadoFarmacia,
  TurnoProgramadoLocalidad,
  TurnoProgramadoRango,
  TurnosFarmaciaListado
} from './../interfaces/farmacia.interface';
import { forkJoin } from 'rxjs';

interface CoordenadasLngLat {
  lng: number;
  lat: number;
}

interface FarmaciaConDistancia {
  farmacia: FarmaciaGeojson;
  distanciaMetros: number;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false
})
export class Tab2Page implements OnInit {
  private readonly farmaciasSourceId = 'farmacias-source';
  private readonly farmaciasTurnoSourceId = 'farmacias-turno-source';
  private readonly farmaciasClusterLayerId = 'farmacias-cluster-layer';
  private readonly farmaciasClusterCountLayerId = 'farmacias-cluster-count-layer';
  private readonly farmaciasLayerId = 'farmacias-layer';
  private readonly farmaciasTurnoHaloLayerId = 'farmacias-turno-halo-layer';
  private readonly farmaciasTurnoHaloFarmaciasLayerId = 'farmacias-turno-halo-farmacias-layer';
  private readonly farmaciasTurnoLayerId = 'farmacias-turno-layer';
  private readonly turnoHaloBasePaint = {
    'circle-radius': 28,
    'circle-color': '#0ea5e9',
    'circle-opacity': 0.18,
    'circle-blur': 0.85,
    'circle-stroke-color': '#38bdf8',
    'circle-stroke-width': 4,
    'circle-stroke-opacity': 0.82
  };
  private readonly turnoHaloAnimationDuration = 2600;
  private readonly turnoHaloAnimatedRadiusBase = 20;
  private readonly turnoHaloAnimatedRadiusRange = 20;
  private readonly turnoHaloAnimatedOpacity = 0.18;
  private readonly turnoHaloAnimatedStrokeOpacity = 0.58;

  mapa: any;
  LngLat: Mapboxgl.LngLat;
  farmacias: FarmaciaGeojson[] = [];
  farmaciasFiltradas: FarmaciaGeojson[] = [];
  farmaciasSource: FarmaciaMapaFeatureCollection = {
    type: 'FeatureCollection',
    features: []
  };
  turnosEsperanza: TurnosFarmaciaListado = null;
  turnosColegio: TurnoProgramadoLocalidad[] = [];
  turnosHoy: TurnoActivo[] = [];
  terminoBusqueda = '';
  visibles = false;
  turnosVisibles = false;
  modoMapa: 'ninguno' | 'farmacias' | 'turnos' = 'ninguno';
  estilo = 'secondary';
  estiloTurnos = 'primary';
  estiloMapa = '';
  buscandoFarmaciaTurnoCercana = false;
  mensajeFarmaciaTurnoCercana = '';
  mapaListo = false;
  iconoFarmaciaCargado = false;
  private popupActivo: Mapboxgl.Popup = null;
  private turnoHaloAnimationId: number | null = null;
  iconoFarmaciaCargando = false;
  constructor(
    private farmaciaService: FarmaciasService,
    private ngZone: NgZone,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  get hayTurnosHoy() {
    return this.turnosHoy.some(item => item.farmacia);
  }

  ngOnInit() {
    // evita la carga con defectos del mapa
    setTimeout(() => this.cargarMapa(), 100);

    setTimeout(() =>
      this.cargarFarmacias(), 1000);

    setTimeout(() =>
      this.mapa.resize(), 1000);
  }


  cargarMapa() {
    const hoy = new Date();
    const hora = hoy.getHours();
    let estiloMapa: string;
    if (hora < 19 && hora > 7) {
      estiloMapa = 'mapbox://styles/mapbox/light-v10';
    } else {
      estiloMapa = 'mapbox://styles/mapbox/dark-v10';
    }
    // inicializa el mapa
    (Mapboxgl as any).accessToken = environment.mapboxKey;
    this.mapa = new Mapboxgl.Map({
      container: 'mapamapbox', // container id
      style: estiloMapa,
      center: [-60.707367, -31.6251114], // starting position lng, lat
      zoom: 13, // starting zoom
      pitch: 15
    });

    this.mapa.addControl(new Mapboxgl.NavigationControl());
    this.mapa.addControl(new Mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true
    }));

    this.mapa.on('load', () => {
      this.mapa.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#aaa',

          // use an 'interpolate' expression to add a smooth transition effect to the
          // buildings as the user zooms in
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      });

      this.mapaListo = true;
      this.cargarImagenFarmacia();
      this.configurarCapasFarmacias();
    });
  }


  // carga el pedido por http
  cargarFarmacias(event?) {
    this.farmaciaService.getFarmacias()
      .subscribe(res => {
        if (event) {
          event.target.complete();
        }
        this.farmacias = res ? res.slice() : [];
        this.buscarFarmacias();
        this.cargarTurnos();
        this.construirFuenteFarmacias();
        this.configurarCapasFarmacias();
        if (this.farmacias.length > 0) {
          console.log('carga exitosa');
          return true;
        } else {
          console.log('problemas para cargar farmacias');
          return false;
        }
      });
  }

  cargarTurnos() {
    if (this.turnosEsperanza && this.turnosColegio.length) {
      this.actualizarTurnosHoy();
      return;
    }

    forkJoin([
      this.farmaciaService.getTurnosEsperanza(),
      this.farmaciaService.getTurnosColegio(),
      this.farmaciaService.getTurnosRosario()
    ]).subscribe(([turnosEsperanza, turnosColegio, turnosRosario]) => {
        this.turnosEsperanza = turnosEsperanza;
        this.turnosColegio = [
          ...(turnosColegio || []),
          ...(turnosRosario || [])
        ];
        this.actualizarTurnosHoy();
        this.construirFuenteFarmacias();
        this.configurarCapasFarmacias();
      });
  }

  // muestra todas las farmacias cargadas
  mostrarFarmacias() {
    this.cerrarPopupActivo();

    if (this.modoMapa === 'farmacias') {
      this.modoMapa = 'ninguno';
      this.actualizarEstadosBotones();
      this.configurarCapasFarmacias();
      return;
    }

    this.modoMapa = 'farmacias';
    this.actualizarEstadosBotones();
    this.configurarCapasFarmacias();
  }

  mostrarTurnosHoy() {
    this.cerrarPopupActivo();

    if (!this.hayTurnosHoy) {
      return;
    }

    if (this.modoMapa === 'turnos') {
      this.modoMapa = 'ninguno';
      this.actualizarEstadosBotones();
      this.configurarCapasFarmacias();
      return;
    }

    this.modoMapa = 'turnos';
    this.actualizarEstadosBotones();
    this.configurarCapasFarmacias();
    this.alejarMapaUnPoco();
  }

  async mostrarFarmaciaTurnoMasCercana() {
    this.cerrarPopupActivo();

    if (this.buscandoFarmaciaTurnoCercana || !this.hayTurnosHoy) {
      return;
    }

    const farmaciasDeTurno = this.obtenerFarmaciasDeTurnoGeorreferenciadas();

    if (!farmaciasDeTurno.length) {
      this.actualizarEstadoBusquedaFarmaciaTurnoCercana(
        false,
        'No hay farmacias de turno con ubicacion disponible.'
      );
      return;
    }

    this.actualizarEstadoBusquedaFarmaciaTurnoCercana(true, 'Buscando tu ubicacion...');

    try {
      const ubicacionUsuario = await this.obtenerUbicacionUsuario();
      const farmaciaMasCercana = this.obtenerFarmaciaMasCercana(ubicacionUsuario, farmaciasDeTurno);

      if (!farmaciaMasCercana) {
        this.actualizarEstadoBusquedaFarmaciaTurnoCercana(
          false,
          'No se pudo calcular la farmacia mas cercana.'
        );
        return;
      }

      this.modoMapa = 'turnos';
      this.actualizarEstadosBotones();
      this.configurarCapasFarmacias();
      this.centrarFarmaciaTurnoMasCercana(farmaciaMasCercana);
      this.actualizarEstadoBusquedaFarmaciaTurnoCercana(
        false,
        ''
      );
    } catch (error) {
      this.actualizarEstadoBusquedaFarmaciaTurnoCercana(
        false,
        this.obtenerMensajeErrorUbicacion(error)
      );
    } finally {
      this.actualizarEstadoBusquedaFarmaciaTurnoCercana(false, this.mensajeFarmaciaTurnoCercana);
    }
  }

  esFarmaciaDeTurno(farmacia: FarmaciaGeojson) {
    if (!farmacia || !farmacia.properties || !this.farmaciasSource || !this.farmaciasSource.features) {
      return false;
    }

    return this.farmaciasSource.features.some(feature => {
      return feature.properties &&
        feature.properties.farma_id === farmacia.properties.farma_id &&
        !!feature.properties.turno;
    });
  }

  buscarFarmacias(valor?) {
    const valorBusqueda = typeof valor === 'string'
      ? valor
      : valor && valor.detail && typeof valor.detail.value === 'string'
        ? valor.detail.value
        : valor && valor.target && typeof valor.target.value === 'string'
          ? valor.target.value
          : this.terminoBusqueda;

    this.terminoBusqueda = valorBusqueda || '';
    const busqueda = this.normalizarTexto(this.terminoBusqueda);

    if (!busqueda) {
      this.farmaciasFiltradas = [];
      return;
    }

    this.farmaciasFiltradas = this.farmacias
      .filter(farmacia => this.farmaciaCoincide(farmacia, busqueda))
      .slice(0, 8);
  }

  buscarFarmaciasPorClick() {
    this.buscarFarmacias(this.terminoBusqueda);
  }

  seleccionarFarmacia(farmacia: FarmaciaGeojson) {
    if (!farmacia) {
      return;
    }

    const { geometry: { coordinates } } = farmacia;
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);

    this.modoMapa = 'farmacias';
    this.actualizarEstadosBotones();
    this.configurarCapasFarmacias();

    this.mapa.flyTo({
      center: [lng, lat],
      zoom: 16,
      essential: true
    });

    this.mostrarPopupFarmacia(farmacia, this.esFarmaciaDeTurno(farmacia));
    this.terminoBusqueda = farmacia.properties.name;
    this.farmaciasFiltradas = [];
  }

  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.farmaciasFiltradas = [];
  }

  private actualizarEstadosBotones() {
    this.visibles = this.modoMapa === 'farmacias';
    this.turnosVisibles = this.modoMapa === 'turnos';
    this.estilo = this.visibles ? 'medium' : 'secondary';
    this.estiloTurnos = this.turnosVisibles ? 'medium' : 'primary';
  }

  private farmaciaCoincide(farmacia: FarmaciaGeojson, busqueda: string) {
    const properties = farmacia && farmacia.properties ? farmacia.properties : null;

    if (!properties) {
      return false;
    }

    const texto = this.normalizarTexto([
      properties.name,
      properties.address,
      properties.localidad,
      properties.phone,
      properties.farma_id
    ].join(' '));

    return texto.includes(busqueda);
  }

  private actualizarTurnosHoy() {
    if (!this.farmacias.length) {
      this.turnosHoy = [];
      return;
    }

    this.turnosHoy = [
      ...this.obtenerTurnosEsperanzaHoy(),
      ...this.obtenerTurnosColegioHoy()
    ];
  }

  private construirFuenteFarmacias() {
    const farmaciasValidas = this.farmacias.filter(farmacia => this.tieneCoordenadasValidas(farmacia));
    const idsDeTurno = new Set(
      this.turnosHoy
        .filter(item => item.farmacia && item.farmacia.properties)
        .map(item => item.farmacia.properties.farma_id)
    );

    this.farmaciasSource = {
      type: 'FeatureCollection',
      features: farmaciasValidas.map(farmacia => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            Number(farmacia.geometry.coordinates[0]),
            Number(farmacia.geometry.coordinates[1])
          ]
        },
        properties: {
          ...farmacia.properties,
          turno: idsDeTurno.has(farmacia.properties.farma_id)
        }
      }))
    };
  }

  private cargarImagenFarmacia() {
    if (!this.mapaListo || this.iconoFarmaciaCargado || this.iconoFarmaciaCargando) {
      return;
    }

    this.iconoFarmaciaCargando = true;
    this.mapa.loadImage('assets/mapbox-icon.png', (error, image) => {
      this.iconoFarmaciaCargando = false;

      if (error || !image) {
        console.error('No se pudo cargar el icono de farmacia', error);
        return;
      }

      if (!this.mapa.hasImage('farmacia-icon')) {
        this.mapa.addImage('farmacia-icon', image);
      }

      this.iconoFarmaciaCargado = true;
      this.configurarCapasFarmacias();
    });
  }

  private configurarCapasFarmacias() {
    if (!this.mapaListo) {
      return;
    }

    this.agregarOActualizarFuenteFarmacias();
    this.agregarCapasFarmacias();
    this.actualizarVisibilidadCapasFarmacias();
  }

  private agregarOActualizarFuenteFarmacias() {
    if (this.mapa.getSource(this.farmaciasSourceId)) {
      this.mapa.getSource(this.farmaciasSourceId).setData(this.farmaciasSource);
    } else {
      this.mapa.addSource(this.farmaciasSourceId, {
        type: 'geojson',
        data: this.farmaciasSource,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 42
      });
    }

    if (this.mapa.getSource(this.farmaciasTurnoSourceId)) {
      this.mapa.getSource(this.farmaciasTurnoSourceId).setData(this.farmaciasSource);
      return;
    }

    this.mapa.addSource(this.farmaciasTurnoSourceId, {
      type: 'geojson',
      data: this.farmaciasSource
    });
  }

  private agregarCapasFarmacias() {
    if (!this.mapa.getLayer(this.farmaciasClusterLayerId)) {
      this.mapa.addLayer({
        id: this.farmaciasClusterLayerId,
        type: 'circle',
        source: this.farmaciasSourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#16a34a',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            20,
            22,
            50,
            28
          ],
          'circle-opacity': 0.9,
          'circle-stroke-color': '#dcfce7',
          'circle-stroke-width': 3
        }
      });

      this.mapa.on('click', this.farmaciasClusterLayerId, (event) => {
        const feature = event && event.features && event.features[0];
        if (!feature || !feature.properties || !feature.geometry) {
          return;
        }

        const clusterId = feature.properties.cluster_id;
        const source = this.mapa.getSource(this.farmaciasSourceId) as any;

        if (!source || typeof source.getClusterExpansionZoom !== 'function') {
          return;
        }

        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error) {
            return;
          }

          this.mapa.easeTo({
            center: feature.geometry.coordinates,
            zoom,
            essential: true,
            duration: 500
          });
        });
      });

      this.mapa.on('mouseenter', this.farmaciasClusterLayerId, () => {
        this.mapa.getCanvas().style.cursor = 'pointer';
      });

      this.mapa.on('mouseleave', this.farmaciasClusterLayerId, () => {
        this.mapa.getCanvas().style.cursor = '';
      });
    }

    if (!this.mapa.getLayer(this.farmaciasClusterCountLayerId)) {
      this.mapa.addLayer({
        id: this.farmaciasClusterCountLayerId,
        type: 'symbol',
        source: this.farmaciasSourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
    }

    if (!this.mapa.getLayer(this.farmaciasLayerId)) {
      this.mapa.addLayer({
        id: this.farmaciasLayerId,
        type: 'symbol',
        source: this.farmaciasSourceId,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'farmacia-icon',
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });

      this.mapa.on('mouseenter', this.farmaciasLayerId, () => {
        this.mapa.getCanvas().style.cursor = 'pointer';
      });

      this.mapa.on('mouseleave', this.farmaciasLayerId, () => {
        this.mapa.getCanvas().style.cursor = '';
      });

      this.mapa.on('click', this.farmaciasLayerId, (event) => {
        const feature = event && event.features && event.features[0];
        if (!feature || !feature.geometry || !feature.geometry.coordinates) {
          return;
        }

        this.mostrarPopupDesdeFeature(feature);
      });
    }

    this.agregarCapaHaloTurno(
      this.farmaciasTurnoHaloLayerId,
      this.farmaciasTurnoSourceId,
      ['==', ['get', 'turno'], true]
    );

    this.agregarCapaHaloTurno(
      this.farmaciasTurnoHaloFarmaciasLayerId,
      this.farmaciasSourceId,
      ['all', ['!', ['has', 'point_count']], ['==', ['get', 'turno'], true]]
    );

    if (!this.mapa.getLayer(this.farmaciasTurnoLayerId)) {
      this.mapa.addLayer({
        id: this.farmaciasTurnoLayerId,
        type: 'symbol',
        source: this.farmaciasTurnoSourceId,
        filter: ['==', ['get', 'turno'], true],
        layout: {
          'icon-image': 'farmacia-icon',
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          visibility: 'none'
        }
      });

      this.mapa.on('mouseenter', this.farmaciasTurnoLayerId, () => {
        this.mapa.getCanvas().style.cursor = 'pointer';
      });

      this.mapa.on('mouseleave', this.farmaciasTurnoLayerId, () => {
        this.mapa.getCanvas().style.cursor = '';
      });

      this.mapa.on('click', this.farmaciasTurnoLayerId, (event) => {
        const feature = event && event.features && event.features[0];
        if (!feature || !feature.geometry || !feature.geometry.coordinates) {
          return;
        }

        this.mostrarPopupDesdeFeature(feature);
      });
    }
  }

  private agregarCapaHaloTurno(layerId: string, sourceId: string, filter: any[]) {
    if (this.mapa.getLayer(layerId)) {
      return;
    }

    this.mapa.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      filter,
      paint: { ...this.turnoHaloBasePaint },
      layout: {
        visibility: 'none'
      }
    });
  }

  private actualizarVisibilidadCapasFarmacias() {
    if (
      !this.mapa.getLayer(this.farmaciasClusterLayerId)
      || !this.mapa.getLayer(this.farmaciasClusterCountLayerId)
      || !this.mapa.getLayer(this.farmaciasLayerId)
      || !this.mapa.getLayer(this.farmaciasTurnoLayerId)
      || !this.mapa.getLayer(this.farmaciasTurnoHaloLayerId)
      || !this.mapa.getLayer(this.farmaciasTurnoHaloFarmaciasLayerId)
    ) {
      return;
    }

    const mostrarFarmacias = this.modoMapa === 'farmacias';
    const mostrarTurnos = this.modoMapa === 'turnos';

    this.mapa.setLayoutProperty(this.farmaciasClusterLayerId, 'visibility', mostrarFarmacias ? 'visible' : 'none');
    this.mapa.setLayoutProperty(this.farmaciasClusterCountLayerId, 'visibility', mostrarFarmacias ? 'visible' : 'none');
    this.mapa.setLayoutProperty(this.farmaciasLayerId, 'visibility', mostrarFarmacias ? 'visible' : 'none');
    this.mapa.setLayoutProperty(this.farmaciasTurnoLayerId, 'visibility', mostrarTurnos ? 'visible' : 'none');
    this.mapa.setLayoutProperty(this.farmaciasTurnoHaloLayerId, 'visibility', mostrarTurnos ? 'visible' : 'none');
    this.mapa.setLayoutProperty(this.farmaciasTurnoHaloFarmaciasLayerId, 'visibility', mostrarFarmacias ? 'visible' : 'none');

    if (mostrarFarmacias || mostrarTurnos) {
      this.iniciarAnimacionHaloTurno();
    } else {
      this.detenerAnimacionHaloTurno();
    }
  }

  private iniciarAnimacionHaloTurno() {
    if (
      this.turnoHaloAnimationId !== null
      || !this.mapa
      || !this.mapa.getLayer(this.farmaciasTurnoHaloLayerId)
      || !this.mapa.getLayer(this.farmaciasTurnoHaloFarmaciasLayerId)
    ) {
      return;
    }

    const animar = (timestamp: number) => {
      if (
        !this.mapa
        || !this.mapa.getLayer(this.farmaciasTurnoHaloLayerId)
        || !this.mapa.getLayer(this.farmaciasTurnoHaloFarmaciasLayerId)
        || (this.modoMapa !== 'farmacias' && this.modoMapa !== 'turnos')
      ) {
        this.turnoHaloAnimationId = null;
        return;
      }

      const progreso = (timestamp % this.turnoHaloAnimationDuration) / this.turnoHaloAnimationDuration;
      const radio = this.turnoHaloAnimatedRadiusBase + progreso * this.turnoHaloAnimatedRadiusRange;
      const opacidad = this.turnoHaloAnimatedOpacity * (1 - progreso);
      const borde = this.turnoHaloAnimatedStrokeOpacity * (1 - progreso);

      [this.farmaciasTurnoHaloLayerId, this.farmaciasTurnoHaloFarmaciasLayerId].forEach(layerId => {
        this.mapa.setPaintProperty(layerId, 'circle-radius', radio);
        this.mapa.setPaintProperty(layerId, 'circle-opacity', opacidad);
        this.mapa.setPaintProperty(layerId, 'circle-stroke-opacity', borde);
      });

      this.turnoHaloAnimationId = requestAnimationFrame(animar);
    };

    this.turnoHaloAnimationId = requestAnimationFrame(animar);
  }

  private detenerAnimacionHaloTurno() {
    if (this.turnoHaloAnimationId !== null) {
      cancelAnimationFrame(this.turnoHaloAnimationId);
      this.turnoHaloAnimationId = null;
    }

    [this.farmaciasTurnoHaloLayerId, this.farmaciasTurnoHaloFarmaciasLayerId].forEach(layerId => {
      if (this.mapa && this.mapa.getLayer(layerId)) {
        this.mapa.setPaintProperty(layerId, 'circle-radius', this.turnoHaloBasePaint['circle-radius']);
        this.mapa.setPaintProperty(layerId, 'circle-opacity', this.turnoHaloBasePaint['circle-opacity']);
        this.mapa.setPaintProperty(layerId, 'circle-stroke-opacity', this.turnoHaloBasePaint['circle-stroke-opacity']);
      }
    });
  }

  private cerrarPopupActivo() {
    if (!this.popupActivo) {
      return;
    }

    this.popupActivo.remove();
    this.popupActivo = null;
  }

  private mostrarPopupDesdeFeature(feature: any) {
    const coordinates = feature.geometry.coordinates.slice();
    const properties = feature.properties || {};

    this.mostrarPopupFarmacia({
      geometry: {
        type: 'Point',
        coordinates
      },
      type: 'Feature',
      properties
    } as FarmaciaGeojson, !!properties.turno);
  }

  private mostrarPopupFarmacia(farmacia: FarmaciaGeojson, deTurno = false, distanciaMetros?: number) {
    if (!farmacia || !farmacia.properties || !farmacia.geometry) {
      return;
    }

    const { geometry: { coordinates }, properties: { name, phone, address } } = farmacia;
    const popupHtml = this.construirContenidoPopup(name, phone, address, deTurno, distanciaMetros);

    this.cerrarPopupActivo();

    this.popupActivo = new Mapboxgl.Popup({
      closeOnClick: true,
      closeButton: true,
      maxWidth: '300px',
      className: 'pharmap-popup'
    })
      .setLngLat([Number(coordinates[0]), Number(coordinates[1])])
      .setHTML(popupHtml)
      .addTo(this.mapa);
  }

  private construirContenidoPopup(name: string, phone: string, address: string, deTurno: boolean, distanciaMetros?: number) {
    const badge = deTurno
      ? '<span class="popup-badge popup-badge--turno">De turno hoy</span>'
      : '';
    const distancia = typeof distanciaMetros === 'number' && Number.isFinite(distanciaMetros)
      ? `
          <div class="popup-row">
            <span class="popup-row__label">Distancia</span>
            <span class="popup-row__value">${this.escaparHtml(this.formatearDistancia(distanciaMetros))} aprox.</span>
          </div>
        `
      : '';

    return `
      <div class="popup-card">
        <div class="popup-card__header">
          <div class="popup-card__title-group">
            <p class="popup-card__eyebrow">Farmacia</p>
            <h3 class="popup-card__title">${this.escaparHtml(name)}</h3>
          </div>
          ${badge}
        </div>
        <div class="popup-card__body">
          <div class="popup-row">
            <span class="popup-row__label">Dirección</span>
            <span class="popup-row__value">${this.escaparHtml(address)}</span>
          </div>
          <div class="popup-row">
            <span class="popup-row__label">Teléfono</span>
            <span class="popup-row__value">${this.escaparHtml(phone)}</span>
          </div>
          ${distancia}
        </div>
      </div>
    `;
  }

  private obtenerFarmaciasDeTurnoGeorreferenciadas() {
    const farmaciasPorId = new Map<string, FarmaciaGeojson>();

    this.turnosHoy.forEach(turno => {
      const farmacia = turno.farmacia;

      if (!farmacia || !farmacia.properties || !this.tieneCoordenadasValidas(farmacia)) {
        return;
      }

      const id = farmacia.properties.farma_id || farmacia.properties.name;

      if (id && !farmaciasPorId.has(id)) {
        farmaciasPorId.set(id, farmacia);
      }
    });

    return Array.from(farmaciasPorId.values());
  }

  private obtenerUbicacionUsuario(): Promise<CoordenadasLngLat> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation-unavailable'));
        return;
      }

      const timeoutId = window.setTimeout(() => {
        reject(new Error('geolocation-timeout'));
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        position => {
          window.clearTimeout(timeoutId);
          this.ngZone.run(() => resolve({
            lng: position.coords.longitude,
            lat: position.coords.latitude
          }));
        },
        error => {
          window.clearTimeout(timeoutId);
          this.ngZone.run(() => reject(error));
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000
        }
      );
    });
  }

  private obtenerFarmaciaMasCercana(
    ubicacionUsuario: CoordenadasLngLat,
    farmacias: FarmaciaGeojson[]
  ): FarmaciaConDistancia | null {
    return farmacias.reduce<FarmaciaConDistancia | null>((masCercana, farmacia) => {
      const [lng, lat] = farmacia.geometry.coordinates.map(coordenada => Number(coordenada));
      const distanciaMetros = this.calcularDistanciaMetros(ubicacionUsuario, { lng, lat });

      if (!masCercana || distanciaMetros < masCercana.distanciaMetros) {
        return { farmacia, distanciaMetros };
      }

      return masCercana;
    }, null);
  }

  private centrarFarmaciaTurnoMasCercana(resultado: FarmaciaConDistancia) {
    const [lng, lat] = resultado.farmacia.geometry.coordinates.map(coordenada => Number(coordenada));

    this.mapa.flyTo({
      center: [lng, lat],
      zoom: 16,
      essential: true
    });

    this.mostrarPopupFarmacia(resultado.farmacia, true, resultado.distanciaMetros);
  }

  private actualizarEstadoBusquedaFarmaciaTurnoCercana(buscando: boolean, mensaje: string) {
    this.ngZone.run(() => {
      this.buscandoFarmaciaTurnoCercana = buscando;
      this.mensajeFarmaciaTurnoCercana = mensaje;
      this.changeDetectorRef.detectChanges();
    });
  }

  private calcularDistanciaMetros(origen: CoordenadasLngLat, destino: CoordenadasLngLat) {
    const radioTierraMetros = 6371000;
    const latOrigen = this.gradosARadianes(origen.lat);
    const latDestino = this.gradosARadianes(destino.lat);
    const deltaLat = this.gradosARadianes(destino.lat - origen.lat);
    const deltaLng = this.gradosARadianes(destino.lng - origen.lng);
    const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(latOrigen) * Math.cos(latDestino) * Math.sin(deltaLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return radioTierraMetros * c;
  }

  private gradosARadianes(grados: number) {
    return grados * Math.PI / 180;
  }

  private formatearDistancia(distanciaMetros: number) {
    if (distanciaMetros < 1000) {
      return `${Math.round(distanciaMetros)} m`;
    }

    return `${(distanciaMetros / 1000).toFixed(1)} km`;
  }

  private obtenerMensajeErrorUbicacion(error: any) {
    if (error && error.code === 1) {
      return 'Necesitamos permiso de ubicacion para buscar la mas cercana.';
    }

    if ((error && error.code === 3) || (error instanceof Error && error.message === 'geolocation-timeout')) {
      return 'No pudimos obtener tu ubicacion a tiempo.';
    }

    return 'No pudimos obtener tu ubicacion.';
  }

  private escaparHtml(texto: string) {
    return (texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private alejarMapaUnPoco() {
    if (!this.mapa) {
      return;
    }

    const zoomActual = this.mapa.getZoom ? this.mapa.getZoom() : 13;
    const nuevoZoom = Math.max(zoomActual - 0.8, 11);

    this.mapa.easeTo({
      zoom: nuevoZoom,
      essential: true,
      duration: 500
    });
  }

  private obtenerTurnosEsperanzaHoy(): TurnoActivo[] {
    if (!this.turnosEsperanza) {
      return [];
    }

    const ahora = new Date();
    const turnoHoy = this.turnosEsperanza.items.find(item =>
      item.rangos && item.rangos.some(rango => this.estaEnRango(ahora, rango))
    );

    if (!turnoHoy) {
      return [];
    }

    return turnoHoy.farmacias
      .filter(turno => !!turno.farmaciaName)
      .map(turno => ({
        farmaciaName: turno.farmaciaName,
        localidad: this.turnosEsperanza.localidad,
        turno: 'Esperanza',
        farmacia: this.buscarFarmaciaPorNombreYLocalidad(turno.farmaciaName, this.turnosEsperanza.localidad)
      }));
  }

  private obtenerTurnosColegioHoy(): TurnoActivo[] {
    if (!this.turnosColegio || !this.turnosColegio.length) {
      return [];
    }

    const ahora = new Date();
    const turnosActivos: TurnoActivo[] = [];

    this.turnosColegio.forEach(localidadTurnos => {
      localidadTurnos.turnos.forEach(turno => {
        const rangoActivo = turno.rangos.find(rango => this.estaEnRango(ahora, rango));

        if (!rangoActivo) {
          return;
        }

        turno.farmacias
          .filter(farmacia => this.farmaciaAplicaARango(farmacia, rangoActivo))
          .forEach(farmacia => {
            const farmaciaMapa = this.buscarFarmaciaPorNombreYLocalidad(farmacia.nombre, localidadTurnos.localidad);

            turnosActivos.push({
              farmaciaName: farmacia.nombre,
              localidad: localidadTurnos.localidad,
              turno: turno.turno,
              farmacia: farmaciaMapa
            });
          });
      });
    });

    return turnosActivos;
  }

  private farmaciaAplicaARango(farmacia: TurnoProgramadoFarmacia, rango: TurnoProgramadoRango) {
    if (!farmacia.soloRangos || !farmacia.soloRangos.length) {
      return true;
    }

    return farmacia.soloRangos.some(item => item.desde === rango.desde && item.hasta === rango.hasta);
  }

  private estaEnRango(fecha: Date, rango: TurnoProgramadoRango) {
    const desde = new Date(rango.desde);
    const hasta = new Date(rango.hasta);

    return fecha >= desde && fecha < hasta;
  }

  private buscarFarmaciaPorNombreYLocalidad(nombre: string, localidad: string) {
    if (!nombre) {
      return null;
    }

    const nombreNormalizado = this.normalizarNombreFarmacia(nombre);
    const localidadNormalizada = this.normalizarTexto(localidad);

    const coincidenciaExacta = this.farmacias.find(farmacia => {
      if (!farmacia || !farmacia.properties) {
        return false;
      }

      return this.normalizarNombreFarmacia(farmacia.properties.name) === nombreNormalizado &&
        this.normalizarTexto(farmacia.properties.localidad) === localidadNormalizada;
    });

    if (coincidenciaExacta) {
      return coincidenciaExacta;
    }

    return this.farmacias.find(farmacia => {
      if (!farmacia || !farmacia.properties) {
        return false;
      }

      const nombreFarmacia = this.normalizarNombreFarmacia(farmacia.properties.name);
      const mismaLocalidad = this.normalizarTexto(farmacia.properties.localidad) === localidadNormalizada;

      return mismaLocalidad && (
        nombreFarmacia.includes(nombreNormalizado) ||
        nombreNormalizado.includes(nombreFarmacia)
      );
    });
  }

  private normalizarNombreFarmacia(texto: string) {
    return this.normalizarTexto(texto)
      .replace(/^farmacia\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizarTexto(texto: string) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private tieneCoordenadasValidas(farmacia: FarmaciaGeojson) {
    if (!farmacia || !farmacia.geometry || !Array.isArray(farmacia.geometry.coordinates)) {
      return false;
    }

    const [lng, lat] = farmacia.geometry.coordinates.map(coordenada => Number(coordenada));

    return Number.isFinite(lng) && Number.isFinite(lat);
  }

  private formatearFecha(fecha: Date) {
    const year = fecha.getFullYear();
    const month = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const day = `${fecha.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }


}
