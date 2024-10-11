import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const fuelTypes = {
  'Diesel': 1.00,
  'Gasoline': 0.88,
  'Biodiesel (B100)': 0.93,
  'Biodiesel (B20)': 0.99,
  'Renewable Diesel (R100)': 0.96,
  'Propane (LPG)': 0.66,
  'Compressed Natural Gas (CNG)': 0.16,
  'Liquefied Natural Gas (LNG)': 0.59,
  'Ethanol (E100)': 0.61,
  'Ethanol (E85)': 0.68,
  'Methanol (M100)': 0.45,
  'Hydrogen': 1.00,
  'Electricity': 0.0266, // 1 DGE = 37.64 kWh, so 1 kWh = 1/37.64 DGE
};

const App = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [participatingEntities, setParticipatingEntities] = useState([
    { name: 'Entity 1', percentage: 20 },
    { name: 'Entity 2', percentage: 20 },
    { name: 'Entity 3', percentage: 20 },
    { name: 'Entity 4', percentage: 20 },
    { name: 'Entity 5', percentage: 20 },
  ]);
  const [selectedFuelType, setSelectedFuelType] = useState('Diesel');
  const [fuelAmount, setFuelAmount] = useState(0);
  const [dge, setDge] = useState(0);
  const [estimatedCredits, setEstimatedCredits] = useState(0);
  const [projectionYears, setProjectionYears] = useState(1);
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = () => {
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          const parsedData = results.data
            .filter(row => row['Weekly Average Credit Price ($)'] !== '')
            .map(row => ({
              date: new Date(row['Week Of']),
              price: parseFloat(row['Weekly Average Credit Price ($)'])
            }));
          setHistoricalData(parsedData);
        },
        header: true
      });
    }
  };

  const handleEntityChange = (index, field, value) => {
    const updatedEntities = [...participatingEntities];
    updatedEntities[index][field] = field === 'percentage' ? parseFloat(value) : value;
    setParticipatingEntities(updatedEntities);
  };

  const calculateLcfsCredits = useCallback((dgeInput) => {
    const ciDiesel = 100.45;  // 2024 diesel CI benchmark
    const ciRenewableDiesel = 30;  // Example CI for renewable diesel
    const energyDensity = 134.47;  // Energy density of diesel (MJ/gal)
    
    const energyInMj = dgeInput * energyDensity;
    const ciDifference = ciDiesel - ciRenewableDiesel;
    const creditsGenerated = (ciDifference * energyInMj) / 1_000_000;
    
    return creditsGenerated;
  }, []);

  useEffect(() => {
    const calculatedDge = fuelAmount * fuelTypes[selectedFuelType];
    setDge(calculatedDge);
    const credits = calculateLcfsCredits(calculatedDge);
    setEstimatedCredits(credits);
  }, [fuelAmount, selectedFuelType, calculateLcfsCredits]);

  const totalPercentage = useMemo(() => {
    return participatingEntities.reduce((sum, entity) => sum + entity.percentage, 0);
  }, [participatingEntities]);

  const projectedCreditValueData = useMemo(() => {
    if (historicalData.length === 0) return [];

    const currentPrice = historicalData[historicalData.length - 1].price;
    const months = projectionYears * 12;

    // Calculate standard deviation of historical prices
    const mean = historicalData.reduce((sum, data) => sum + data.price, 0) / historicalData.length;
    const variance = historicalData.reduce((sum, data) => sum + Math.pow(data.price - mean, 2), 0) / historicalData.length;
    const stdDev = Math.sqrt(variance);

    return Array.from({ length: months }, (_, i) => {
      const randomFactor = 1 + (Math.random() - 0.5) * 0.1; // Random factor between 0.95 and 1.05
      const baseValue = currentPrice * Math.pow(1.01, i) * randomFactor; // 1% monthly increase with randomness
      return {
        month: i + 1,
        base: baseValue,
        optimistic: baseValue + stdDev,
        pessimistic: baseValue - stdDev,
      };
    });
  }, [historicalData, projectionYears]);

  const projectedRevenueData = useMemo(() => {
    return projectedCreditValueData.map(data => ({
      ...data,
      baseRevenue: data.base * estimatedCredits,
      optimisticRevenue: data.optimistic * estimatedCredits,
      pessimisticRevenue: data.pessimistic * estimatedCredits,
    }));
  }, [projectedCreditValueData, estimatedCredits]);

  const projectedCreditValueChartData = {
    labels: projectedCreditValueData.map(d => `Month ${d.month}`),
    datasets: [
      {
        label: 'Base',
        data: projectedCreditValueData.map(d => d.base),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
      },
      {
        label: 'Optimistic',
        data: projectedCreditValueData.map(d => d.optimistic),
        borderColor: 'rgba(0, 255, 0, 0.5)',
        backgroundColor: 'rgba(0, 255, 0, 0.2)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
      },
      {
        label: 'Pessimistic',
        data: projectedCreditValueData.map(d => d.pessimistic),
        borderColor: 'rgba(255, 0, 0, 0.5)',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
      },
    ]
  };

  const projectedCreditValueChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Projected LCFS Credit Value',
        font: {
          size: 16,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Month',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Credit Value ($)',
        },
        beginAtZero: true,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  return (
    <div className="App">
      <div className="header">
        <h1>LCFS Revenue Share Calculator</h1>
      </div>
      <div className="content">
        <div className="two-column">
          <div className="column">
            <h2>LCFS Credit Calculator</h2>
            <div>
              <label htmlFor="fuel-type">Select Fuel Type:</label>
              <select
                id="fuel-type"
                value={selectedFuelType}
                onChange={(e) => setSelectedFuelType(e.target.value)}
              >
                {Object.keys(fuelTypes).map((fuel) => (
                  <option key={fuel} value={fuel}>{fuel}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fuel-amount">Enter Fuel Amount:</label>
              <input
                type="number"
                id="fuel-amount"
                value={fuelAmount}
                onChange={(e) => setFuelAmount(parseFloat(e.target.value))}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <p>Diesel Gallon Equivalent (DGE): {dge.toFixed(2)}</p>
              <p>Estimated LCFS credits: {estimatedCredits.toFixed(2)}</p>
            </div>
          </div>
          <div className="column">
            <h2>Participating Entities</h2>
            <div className="entities-grid">
              {participatingEntities.map((entity, index) => (
                <div key={index} className="entity-item">
                  <input
                    type="text"
                    value={entity.name}
                    onChange={(e) => handleEntityChange(index, 'name', e.target.value)}
                  />
                  <div className="percentage-input">
                    <input
                      type="number"
                      value={entity.percentage}
                      onChange={(e) => handleEntityChange(index, 'percentage', parseFloat(e.target.value))}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span>%</span>
                  </div>
                </div>
              ))}
            </div>
            {totalPercentage !== 100 && (
              <p style={{ color: 'red' }}>Total percentage must equal 100%. Current total: {totalPercentage.toFixed(1)}%</p>
            )}
          </div>
        </div>

        <div>
          <h2>Upload Historical LCFS Credit Value CSV</h2>
          <input type="file" onChange={handleFileChange} accept=".csv" />
          <button onClick={handleSubmit}>Upload and Process</button>
        </div>
        
        {historicalData.length > 0 && (
          <div className="chart-container">
            <h2>Historical LCFS Credit Values</h2>
            <Line
              data={{
                labels: historicalData.map(d => d.date.toLocaleDateString()),
                datasets: [{
                  label: 'Historical Data',
                  data: historicalData.map(d => d.price),
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.1
                }]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: 'LCFS Credit Value',
                  },
                },
              }}
            />
          </div>
        )}

        <div>
          <h2>Projection Years</h2>
          <select value={projectionYears} onChange={(e) => setProjectionYears(parseInt(e.target.value))}>
            <option value={1}>1 Year</option>
            <option value={5}>5 Years</option>
            <option value={10}>10 Years</option>
          </select>
        </div>

        {projectedCreditValueData.length > 0 && (
          <div>
            <h2>Projected LCFS Credit Value</h2>
            <div className="chart-container">
              <Line data={projectedCreditValueChartData} options={projectedCreditValueChartOptions} />
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Base Revenue</th>
                    <th>Optimistic Revenue</th>
                    <th>Pessimistic Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {projectedRevenueData.map((data, index) => (
                    <tr key={index}>
                      <td>{data.month}</td>
                      <td>${data.baseRevenue.toFixed(2)}</td>
                      <td>${data.optimisticRevenue.toFixed(2)}</td>
                      <td>${data.pessimisticRevenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;