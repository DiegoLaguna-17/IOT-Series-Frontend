<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend } from "chart.js";
import { io } from "socket.io-client";
import axios from "axios";
import { obtenerSeries, obtenerSeriesDatos } from "../services/UsuarioService";

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip, Legend);

const chartRefValor = ref(null);
const chartRefError = ref(null);
let chartValor = null;
let chartError = null;

const socket = io("http://localhost:3000"); // tu backend

// Estado
const seriesList = ref([]);
const selectedSerie = ref("");

// Función para transformar cálculos a datos de Chart.js
const prepararDatos = (data) => {
  const allIterations = data.flatMap(calculo =>
    calculo.iteraciones.map(iter => ({
      fecha: new Date(calculo.fecha),
      paso: iter.paso,
      valor: iter.valor,
      error: iter.error
    }))
  );

  allIterations.sort((a, b) => a.fecha - b.fecha || a.paso - b.paso);

  return {
    labels: allIterations.map(item =>
      `${item.fecha.toLocaleDateString()} ${item.fecha.toLocaleTimeString()} P${item.paso}`
    ),
    valores: allIterations.map(item => item.valor),
    errores: allIterations.map(item => item.error)
  };
};

// Cargar series del backend
const cargarSeries = async () => {
  try {
    const res = await obtenerSeries()
    seriesList.value = res.data.data;
    if (seriesList.value.length) selectedSerie.value = seriesList.value[0]._id;
  } catch (error) {
    console.error("Error cargando series:", error);
  }
};

// Cargar datos iniciales de la serie seleccionada
const cargarDatosSerie = async (serieId) => {
  try {
    if (!serieId) return;
    const res = await obtenerSeriesDatos(serieId)
    const { labels, valores, errores } = prepararDatos(res.data.data);

    // Destruir gráficos anteriores si existen
    if (chartValor) chartValor.destroy();
    if (chartError) chartError.destroy();

    // Gráfico de valores
    chartValor = new Chart(chartRefValor.value, {
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
          title: { display: true, text: "Evolución de Iteraciones" }
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
        scales: { x: { title: { display: true, text: "Fecha y hora" } }, y: { title: { display: true, text: "Valor" } } }
      }
    });

    // Gráfico de errores
    chartError = new Chart(chartRefError.value, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Error de aproximación",
          data: errores,
          borderColor: "rgba(255,0,0,1)",
          backgroundColor: "rgba(124,153,47,0.2)",
          fill: false,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: { mode: "index", intersect: false },
          title: { display: true, text: "Error de Aproximación" }
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
        scales: { x: { title: { display: true, text: "Fecha y hora" } }, y: { title: { display: true, text: "Error" } } }
      }
    });

  } catch (error) {
    console.error("Error cargando datos de la serie:", error);
  }
};

// Agregar nuevo cálculo solo si corresponde a la serie activa
const agregarNuevoCalculo = (nuevoCalculo) => {
  if (!selectedSerie.value) return;
  if (nuevoCalculo.serie !== selectedSerie.value) return;

  const iteraciones = nuevoCalculo.iteraciones.map(iter => ({
    fecha: new Date(nuevoCalculo.fecha),
    paso: iter.paso,
    valor: iter.valor,
    error: iter.error
  }));

  iteraciones.forEach(item => {
    const label = `${item.fecha.toLocaleDateString()} ${item.fecha.toLocaleTimeString()} P${item.paso}`;
    chartValor.data.labels.push(label);
    chartValor.data.datasets[0].data.push(item.valor);

    chartError.data.labels.push(label);
    chartError.data.datasets[0].data.push(item.error);
  });

  chartValor.update();
  chartError.update();
};

// Watcher para cambiar de serie
watch(selectedSerie, async (newSerie) => {
  await cargarDatosSerie(newSerie);
});

onMounted(async () => {
  await cargarSeries();
  await cargarDatosSerie(selectedSerie.value);

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

    <canvas ref="chartRefValor" style="margin-bottom:40px;"></canvas>
    <canvas ref="chartRefError"></canvas>
  </div>
</template>