<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip } from "chart.js";
import { io } from "socket.io-client";
import axios from "axios";
import { obtenerSeriesDatos } from "../services/UsuarioService";

// Chart.js setup
Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip);

const chartRef = ref(null);
let chartInstance = null;
const socket = io("http://localhost:3000"); // tu backend

// Estado
const seriesList = ref([]);
const selectedSerie = ref(""); // _id de la serie activa

// Función para transformar cálculos a datos de Chart.js
const prepararDatos = (data) => {
  const allIterations = data.flatMap(calculo =>
    calculo.iteraciones.map(iter => ({
      fecha: new Date(calculo.fecha),
      paso: iter.paso,
      valor: iter.valor
    }))
  );

  allIterations.sort((a, b) => a.fecha - b.fecha || a.paso - b.paso);

  return {
    labels: allIterations.map(item =>
      `${item.fecha.toLocaleDateString()} ${item.fecha.toLocaleTimeString()} P${item.paso}`
    ),
    valores: allIterations.map(item => item.valor)
  };
};

// Cargar series del backend
const cargarSeries = async () => {
  try {
    const res = await axios.get("http://localhost:3000/api/series"); // endpoint que devuelve todas las series
    seriesList.value = res.data.data; // asumimos {success:true,data:[{_id,nombre,funcion,...},...]}
    if (seriesList.value.length) selectedSerie.value = seriesList.value[0]._id;
  } catch (error) {
    console.error("Error cargando series:", error);
  }
};

// Cargar datos iniciales para la serie activa
const cargarDatosSerie = async (serieId) => {
  try {
    if (!serieId) return;
    const res = await obtenerSeriesDatos(serieId)
    const { labels, valores } = prepararDatos(res.data.data);

    if (chartInstance) {
      chartInstance.destroy(); // destruir gráfico anterior
    }

    chartInstance = new Chart(chartRef.value, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Valor de las iteraciones",
          data: valores,
          borderColor: "rgba(180,122,179,1)",
          backgroundColor: "rgba(180,122,179,0.2)",
          fill: false,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: { mode: "index", intersect: false },
          title: { display: true, text: "Evolución de Iteraciones por Fecha" }
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
        scales: {
          x: { title: { display: true, text: "Fecha y hora" } },
          y: { title: { display: true, text: "Valor" } }
        }
      }
    });
  } catch (error) {
    console.error("Error cargando datos de la serie:", error);
  }
};

// Agregar nuevo cálculo solo si corresponde a la serie activa
const agregarNuevoCalculo = (nuevoCalculo) => {
  if (!chartInstance) return;
  if (nuevoCalculo.serie !== selectedSerie.value) return; // filtra por serie activa

  const iteraciones = nuevoCalculo.iteraciones.map(iter => ({
    fecha: new Date(nuevoCalculo.fecha),
    paso: iter.paso,
    valor: iter.valor
  }));

  iteraciones.forEach(item => {
    chartInstance.data.labels.push(`${item.fecha.toLocaleDateString()} ${item.fecha.toLocaleTimeString()} P${item.paso}`);
    chartInstance.data.datasets[0].data.push(item.valor);
  });

  chartInstance.update();
};

// Watcher: cuando cambia la serie seleccionada, recargar datos
watch(selectedSerie, async (newSerie) => {
  await cargarDatosSerie(newSerie);
});

onMounted(async () => {
  await cargarSeries();        // carga series disponibles
  await cargarDatosSerie(selectedSerie.value); // carga datos iniciales

  // Escuchar cálculos nuevos en tiempo real
  socket.on("nuevoCalculo", (nuevo) => {
    console.log("Nuevo cálculo recibido:", nuevo);
    agregarNuevoCalculo(nuevo);
  });
});

onBeforeUnmount(() => {
  socket.off("nuevoCalculo");
  socket.disconnect();
});
</script>

<template>
  <div>
    <label for="serieSelect">Selecciona la serie:</label>
    <select id="serieSelect" v-model="selectedSerie">
      <option v-for="serie in seriesList" :key="serie._id" :value="serie._id">
        {{ serie.nombre }}
      </option>
    </select>

    <canvas ref="chartRef"></canvas>
  </div>
</template>