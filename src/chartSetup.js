// Chart.js v3+ requires registering only the pieces you use.
// Import this file once (from StatsScreen) and it wires everything up.
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement,
  Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement,
  Tooltip, Legend, Filler
);

export default ChartJS;
