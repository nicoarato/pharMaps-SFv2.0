export interface Farmacia {
    nombre: string;
    telefono: string;
    direccion: string;
    coords: number[];
}

export interface Geometry {
    type: string;
    coordinates: number[];
}

export interface Properties {
    address: string;
    name: string;
    phone: string;
    localidad: string;
    provincia: string;
    zip_code: string;
    farma_id: string;
    version: string;
}

export interface FarmaciaGeojson {
    geometry: Geometry;
    type: string;
    properties: Properties;
}

export interface FarmaciaMapaProperties extends Properties {
    turno?: boolean;
}

export interface FarmaciaMapaFeature {
    geometry: Geometry;
    type: 'Feature';
    properties: FarmaciaMapaProperties;
}

export interface FarmaciaMapaFeatureCollection {
    type: 'FeatureCollection';
    features: FarmaciaMapaFeature[];
}

export interface FarmaciaTurno {
    alias: string;
    farmaciaName: string | null;
}

export interface TurnoFarmaciaItem {
    date: string;
    farmacias: FarmaciaTurno[];
}

export interface TurnosFarmaciaSource {
    name: string;
    url: string;
    retrievedAt: string;
}

export interface TurnosFarmaciaListado {
    source: TurnosFarmaciaSource;
    localidad: string;
    turnoHorario: string;
    items: TurnoFarmaciaItem[];
}

export interface TurnoProgramadoRango {
    desde: string;
    hasta: string;
}

export interface TurnoProgramadoFarmacia {
    nombre: string;
    direccion: string;
    telefono: string;
    soloRangos?: TurnoProgramadoRango[];
}

export interface TurnoProgramadoBloque {
    turno: string;
    rangos: TurnoProgramadoRango[];
    farmacias: TurnoProgramadoFarmacia[];
}

export interface TurnoProgramadoFuente {
    tipo: string;
    fechaReferencia: string;
    nota: string;
}

export interface TurnoProgramadoLocalidad {
    localidad: string;
    mes: string;
    turnos: TurnoProgramadoBloque[];
    fuente: TurnoProgramadoFuente;
}

export interface TurnoActivo {
    farmaciaName: string;
    localidad: string;
    turno: string;
    farmacia: FarmaciaGeojson | null;
}
