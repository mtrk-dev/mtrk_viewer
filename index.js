import data from "./miniflash.json" assert { type: 'json' };

function plot_sequence(data) {
    const rf_pulse_data = data["arrays"]["rfpulse"]["data"]
    const rf_odd_data = []
    const rf_even_data = []
    for (let i=0; i < 128; i++) {
        rf_even_data.push(rf_pulse_data[2*i]);
        rf_odd_data.push(rf_pulse_data[2*i+1])
    }

    // Number of reps for all the steps
    // const reps = data["instructions"]["main"]["steps"][0]["range"];
    const reps = 2;

    const rf_data = Array(2000 * reps).fill(0);
    const slice_data = Array(2000 * reps).fill(0);
    const phase_data = Array(2000 * reps).fill(0);
    const readout_data = Array(2000 * reps).fill(0);
    const adc_data = Array(2000 * reps).fill(0);

    // Arrays to store gradient info for web display
    const slice_info = []
    const phase_info = []
    const readout_info = []

    // Repeating the steps 
    for (let rep=0; rep<reps; rep++) {

        // Filling rf data
        let t = 10 + rep*2000;
        for (let i=0; i<rf_even_data.length; i++) {
            rf_data[t] = rf_even_data[i];
            t++;
        }

        // Storing the steps
        const steps = data["instructions"]["block_TR"]["steps"];
        
        // Executing each step and filling axis arrays.
        steps.forEach(function (item, index) {
            if(item["axis"] == "slice" || item["axis"] == "phase" || item["axis"] == "read") {
                let start = item["time"]/10 + rep*2000;
                let object = item["object"];
                let amplitude = parseInt(data["objects"][object]["amplitude"]);

                // Updating the amplitude if available in the step.
                if ("amplitude" in item) {
                    if (item["amplitude"] === "flip") {
                        amplitude = amplitude * -1;
                    }
                    else if ("equation" in item["amplitude"]) {
                        amplitude = 0.3378125*(rep-64.5);
                        data["objects"][object]["amplitude"] = amplitude;
                    }
                }

                let array_name = data["objects"][object]["array"];
                let array_data = data["arrays"][array_name]["data"].map(function(x) { return x * -amplitude});

                // Filling the step info
                const step_info = "Rep " + (rep+1).toString() + ": " + 
                                (start*10).toString() + "µs - " + ((start+array_data.length)*10).toString() + "µs: " + object;

                if (item["axis"] == "slice") { 
                    slice_info.push(step_info);
                } else if (item["axis"] == "phase") { 
                    phase_info.push(step_info);
                } else if (item["axis"] == "read") { 
                    readout_info.push(step_info);
                }

                for (let i=0; i<array_data.length; i++) {
                    if (item["axis"] == "slice") { 
                        slice_data[start] = array_data[i]; 
                    } else if (item["axis"] == "phase") { 
                        phase_data[start] = array_data[i]; 
                    } else if (item["axis"] == "read") { 
                        readout_data[start] = array_data[i];
                    }
                    start++;
                }
            } else if (item["action"] == "adc") {
                let start = item["time"]/10 + rep*2000;
                let object = item["object"];
                let duration = data["objects"][object]["duration"]/10;
                
                for (let i=0; i<duration; i++) {
                    adc_data[start] = 1;
                    start += 1
                }
            }
        });
    }

    // Taking standard x-axis for all the plots.
    const x_standard = []
    for (let i=0; i<20000*reps; i+=10) {
        x_standard.push(i);
    }

    const plot_rf_data = {
    x: x_standard,
    y: rf_data,
    xaxis: 'x1',
    yaxis: 'y1',
    type: 'scatter',
    // mode: 'lines+markers',
    // marker: { size: 5 },
    name: 'RF pulse'
    };

    const plot_slice_data = {
    x: x_standard,
    y: slice_data,
    xaxis: 'x2',
    yaxis: 'y2',
    type: 'scatter',
    // mode: 'lines+markers',
    name: 'slice',
    // marker: { size: 5 },
    };

    const plot_phase_data = {
    x: x_standard,
    y: phase_data,
    xaxis: 'x3',
    yaxis: 'y3',
    type: 'scatter',
    // mode: 'lines+markers',
    name: 'phase',
    // marker: { size: 5 },
    };

    const plot_readout_data = {
    x: x_standard,
    y: readout_data,
    xaxis: 'x4',
    yaxis: 'y4',
    type: 'scatter',
    // mode: 'lines+markers',
    name: 'readout',
    // marker: { size: 5 },
    };

    const plot_adc_data = {
    x: x_standard,
    y: adc_data,
    xaxis: 'x5',
    yaxis: 'y5',
    type: 'scatter',
    // mode: 'lines+markers',
    name: 'ADC',
    // marker: { size: 5 },
    };

    var stacked_plots = [plot_rf_data, plot_slice_data, plot_phase_data, plot_readout_data, plot_adc_data];

    var layout = {
    grid: {
        rows: 5,
        columns: 1,
        pattern: 'independent'},
    plot_bgcolor:"rgba(0,0,0,0.1)",
    paper_bgcolor:"rgba(0,0,0,0.6)",
    height: window.innerHeight,
    legend: {
        font: {
        family: 'sans-serif',
        size: 12,
        color: 'rgba(255,255,255,0.8)'
        },
    },
    xaxis1: {
        tickformat: "digits",
        "showticklabels": true,
        "matches": "x5",
        tickfont : {
        color : 'rgba(255,255,255,0.9)',
        gridcolor: 'red'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
    },
    xaxis2: {
        tickformat: "digits",
        "showticklabels": true,
        "matches": "x5",
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
    },
    xaxis3: {
        tickformat: "digits",
        "showticklabels": true,
        "matches": "x5",
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
    },
    xaxis4: {
        tickformat: "digits",
        "showticklabels": true,
        "matches": "x5",
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
    },
    xaxis5: {
        title: "time (µs)",
        titlefont: {
            family: 'Arial, sans-serif',
            size: 12,
            color: 'rgba(255,255,255,0.9)'
        },
        tickformat: "digits",
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
    },
    yaxis1: {
        title: "RF (V)",
        titlefont: {
            family: 'Arial, sans-serif',
            size: 12,
            color: 'rgba(255,255,255,0.9)'
        },
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
        fixedrange: true,
    },
    yaxis2: {
        title: "Slice (mT/m)",
        titlefont: {
            family: 'Arial, sans-serif',
            size: 12,
            color: 'rgba(255,255,255,0.9)'
        },
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
        fixedrange: true,
    },
    yaxis3: {
        title: "Phase (mT/m)",
        titlefont: {
            family: 'Arial, sans-serif',
            size: 12,
            color: 'rgba(255,255,255,0.9)'
        },
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
        fixedrange: true,
    },
    yaxis4: {
        title: "Readout (mT/m)",
        titlefont: {
            family: 'Arial, sans-serif',
            size: 12,
            color: 'rgba(255,255,255,0.9)'
        },
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
        fixedrange: true,
    },
    yaxis5: {
        title: "ADC (on/off)",
        titlefont: {
            family: 'Arial, sans-serif',
            size: 12,
            color: 'rgba(255,255,255,0.9)'
        },
        tickfont : {
        color : 'rgba(255,255,255,0.9)'
        },
        "gridcolor": "rgba(255,255,255,0.05)",
        "zerolinecolor": "rgba(255,255,255,0.5)",
        fixedrange: true,
    },
    };

    const config = {
        scrollZoom: true,
        responsive: true,
    }

    Plotly.newPlot('chart1', stacked_plots, layout, config);

    // If the size of window is changed, we plot again!
    window.onresize = function() {
        layout["height"] = window.innerHeight;
        Plotly.newPlot('chart1', stacked_plots, layout, config);
    };

    // Adding the plot info to the page
    slice_info.forEach(function (item, index) {
        document.getElementById("sliceInfo").innerHTML += "<code>" + item + "</code><br>"
    });
    phase_info.forEach(function (item, index) {
        document.getElementById("phaseInfo").innerHTML += "<code>" + item + "</code><br>"
    });
    readout_info.forEach(function (item, index) {
        document.getElementById("readoutInfo").innerHTML += "<code>" + item + "</code><br>"
    });
}

plot_sequence(data);

const fileInput = document.getElementById('formFile');
fileInput.oninput = () => {
  const selectedFile = fileInput.files[0];
  var reader = new FileReader();
  reader.readAsText(selectedFile, "UTF-8");
  reader.onload = function(e) {
    var newData = JSON.parse(reader.result);
    plot_sequence(newData);
    };
}