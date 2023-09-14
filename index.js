import data from "./miniflash.json" assert { type: 'json' };

function plot_sequence(data) {
    const rf_pulse_data = data["arrays"]["rfpulse"]["data"]
    const rf_odd_data = []
    const rf_even_data = []
    for (let i=0; i < 128; i++) {
        rf_even_data.push(rf_pulse_data[2*i]);
        rf_odd_data.push(rf_pulse_data[2*i+1])
    }

    // Storing the steps
    const steps = data["instructions"]["block_TR"]["steps"];

    // Number of reps for all the steps
    const reps = data["instructions"]["main"]["steps"][0]["range"];
    // const reps = 2;

    // Step size - Siemens
    const step_size = 10;

    // Getting the array size from last step
    var size;
    steps.forEach(function (item, index) {
        if(item["action"] == "mark") {
            size = item["time"];
        }
    });
    const array_size = size/step_size;

    const rf_data = Array(array_size * reps).fill(0);
    const slice_data = Array(array_size * reps).fill(0);
    const phase_data = Array(array_size * reps).fill(0);
    const readout_data = Array(array_size * reps).fill(0);
    const adc_data = Array(array_size * reps).fill(0);

    // Arrays to store gradient info for web display
    const slice_info = []
    const phase_info = []
    const readout_info = []

    // Arrays to store object info for hover text
    const rf_text = Array(array_size * reps).fill("None");
    const slice_text = Array(array_size * reps).fill("None");
    const phase_text = Array(array_size * reps).fill("None");
    const readout_text = Array(array_size * reps).fill("None");
    const adc_text = Array(array_size * reps).fill("None");

    // Repeating the steps 
    for (let rep=0; rep<reps; rep++) {
        // Executing each step and filling axis arrays.
        steps.forEach(function (item, index) {
            if (item["action"] == "rf") {
                let start = item["time"]/step_size + rep*array_size;
                let object = item["object"];
                for (let i=0; i<rf_even_data.length; i++) {
                    rf_data[start] = rf_even_data[i];
                    rf_text[start] = object;
                    start++;
                }
            } else if(item["axis"] == "slice" || item["axis"] == "phase" || item["axis"] == "read") {
                let start = item["time"]/step_size + rep*array_size;
                let object = item["object"];
                let amplitude = parseInt(data["objects"][object]["amplitude"]);

                // Updating the amplitude if available in the step.
                if ("amplitude" in item) {
                    if (item["amplitude"] === "flip") {
                        amplitude = amplitude * -1;
                    }
                    else if ("equation" in item["amplitude"]) {
                        var equation_name = item["amplitude"]["equation"]
                        var equation = data["equations"][equation_name]["equation"];
                        amplitude = evaluate_equation(equation, rep);
                        data["objects"][object]["amplitude"] = amplitude;
                    }
                }

                let array_name = data["objects"][object]["array"];
                let array_data = data["arrays"][array_name]["data"].map(function(x) { return x * -amplitude});

                // Filling the step info
                const step_info = "Rep " + (rep+1).toString() + ": " + 
                                (start*step_size).toString() + "µs - " + ((start+array_data.length)*step_size).toString() + "µs: " + object;

                if (rep < 1) {
                    if (item["axis"] == "slice") { 
                        slice_info.push(step_info);
                    } else if (item["axis"] == "phase") { 
                        phase_info.push(step_info);
                    } else if (item["axis"] == "read") { 
                        readout_info.push(step_info);
                    }
                }

                for (let i=0; i<array_data.length; i++) {
                    if (item["axis"] == "slice") { 
                        slice_data[start] = array_data[i];
                        slice_text[start] = object;
                    } else if (item["axis"] == "phase") { 
                        phase_data[start] = array_data[i];
                        phase_text[start] = object; 
                    } else if (item["axis"] == "read") { 
                        readout_data[start] = array_data[i];
                        readout_text[start] = object;
                    }
                    start++;
                }
            } else if (item["action"] == "adc") {
                let start = item["time"]/step_size + rep*array_size;
                let object = item["object"];
                let duration = data["objects"][object]["duration"]/step_size;
                
                for (let i=0; i<duration; i++) {
                    adc_data[start] = 1;
                    adc_text[start] = object;
                    start += 1
                }
            }
        });
    }

    // Taking standard x-axis for all the plots.
    const x_standard = []
    for (let i=0; i<array_size*step_size*reps; i+=step_size) {
        x_standard.push(i/1000);
    }

    const plot_rf_data = {
    x: x_standard,
    y: rf_data,
    xaxis: 'x1',
    yaxis: 'y1',
    type: 'scatter',
    // mode: 'lines+markers',
    // marker: { size: 5 },
    name: 'RF pulse',
    text: rf_text,
    hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
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
    text: slice_text,
    hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
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
    text: phase_text,
    hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
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
    text: readout_text,
    hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
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
    text: adc_text,
    hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
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
        title: "time (ms)",
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
    const myPlot = document.getElementById('chart1');

    // If the size of window is changed, we update the layout!
    window.onresize = function() {
        var update = {
            "height": window.innerHeight,
            "width": $("#chart1").width(),
        }
        Plotly.relayout(myPlot, update);
    };

    // If more zoomed out than the initial zoom- reset it.
    myPlot.on('plotly_relayout',(e)=>{
        var zoom_level = e['xaxis.range[0]'];
        if (zoom_level < 0){
            var update = {
                'xaxis.autorange': true,
            };
            Plotly.relayout(myPlot, update);
        }
    })

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

function evaluate_equation(equation, rep) {
    // To replace ctr(1) with the current rep value.
    function ctr() {
        return rep;
    }

    // If existing, it will replace the substring.
    // We can add support for more functions accordingly.
    var newEquation = equation.replace("sin", "Math.sin");
    newEquation = newEquation.replace("cos", "Math.cos");
    newEquation = newEquation.replace("tan", "Math.tan");
    newEquation = newEquation.replace("cot", "Math.cot");
    newEquation = newEquation.replace("sec", "Math.sec");
    newEquation = newEquation.replace("csc", "Math.csc");
    newEquation = newEquation.replace("exp", "Math.exp");

    var val = eval(newEquation);

    return val;
}

$(document).ready(function() {
    plot_sequence(data);
    const fileInput = document.getElementById('formFile');
    fileInput.oninput = () => {
    const selectedFile = fileInput.files[0];
    var reader = new FileReader();
    reader.readAsText(selectedFile, "UTF-8");
    reader.onload = function(e) {
        try {
            var newData = JSON.parse(reader.result);
            plot_sequence(newData);
            $("#alert").hide();
        } catch ({ name, message }) {
            $("#alert").show();
        }
        };
    }
});
