import api from "../../../services";



export const obtenerSeries=async()=>{
    return api.get("/series")
}


export const crearCalculo=async(datos)=>{
    try{
        const response=await api.post("/calculos",datos)
        return response.data;
    }catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return {
      exito: false,
      mensaje: "Error de conexion con el servidor",
      errores: ["No se pudo conectar con el backend"],
    };
  }
}