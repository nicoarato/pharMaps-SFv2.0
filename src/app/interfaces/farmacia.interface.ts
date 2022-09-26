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