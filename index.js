import data from "./miniflash.json" with { type: 'json' };
import { createJSONEditor } from 'https://cdn.jsdelivr.net/npm/vanilla-jsoneditor/standalone.js'

function dfs_visit_block(block_name, instructions, visited_blocks, steps_to_plot) {
    if (block_name in visited_blocks) return;
    visited_blocks[block_name] = true;

    let block_data = instructions[block_name];
    let steps = block_data.steps;
    let range = 1;
    steps_to_plot[block_name] = {"reps": 1, "steps": []};

    for (let step of steps) {
        if (step.action == "run_block") {
            dfs_visit_block(step.block, instructions, visited_blocks, steps_to_plot);
        } else if (step.action == "loop") {
            range = step.range;
            steps.push.apply(steps, step.steps);
        } else if (step.action == "rf" || step.action == "grad" || step.action == "adc" || step.action == "mark") {
            steps_to_plot[block_name]["steps"].push(step);
        } else if (step.action == "init" || step.action == "sync" || step.action == "calc") {
            // TODO: deal with even actions
        }
    }

    steps_to_plot[block_name]["reps"] = range;
    steps_to_plot[block_name]["steps"].sort((a, b) => a.time - b.time);
}

function plot_sequence(data) {
    var rf_pulse_data = [];
    if ("rfpulse" in data["arrays"])  rf_pulse_data = data["arrays"]["rfpulse"]["data"];
    else rf_pulse_data = data["arrays"]["rf_pulse"]["data"];

    const rf_odd_data = []
    const rf_even_data = []
    for (let i=0; i < 128; i++) {
        rf_even_data.push(rf_pulse_data[2*i]);
        rf_odd_data.push(rf_pulse_data[2*i+1])
    }

    // Storing the steps that need to be plotted
    var visited_blocks = {};
    var steps_to_plot = {};
    var instructions = JSON.parse(JSON.stringify(data["instructions"]));
    for (let block_name in instructions) {
        dfs_visit_block(block_name, instructions, visited_blocks, steps_to_plot);
        visited_blocks[block_name] = true;
    }

    // Step size - Siemens
    const step_size = 10;

    // storing the objects
    const objects = data["objects"];

    // Getting the array size from last step
    var size;
    for (let block_name in steps_to_plot) {
        steps_to_plot[block_name]["steps"].forEach(function (item, index) {
            if(item["action"] == "mark") {
                size = item["time"];
            }
        });
    }
    const array_size = size/step_size;

    const rf_data = [];
    const slice_data = [];
    const phase_data = [];
    const readout_data = [];
    const adc_data = [];

    var rf_data_x = [];
    var slice_data_x = [];
    var phase_data_x = [];
    var readout_data_x = [];
    var adc_data_x = [];


    // Arrays to store object info for hover text
    const rf_text = [];
    const slice_text = [];
    const phase_text = [];
    const readout_text = [];
    const adc_text = [];

    // Repeating the steps
    let reps = 1;
    for (let block_name in steps_to_plot) {
        for (let rep=0; rep<reps; rep++) {
            // Executing each step and filling axis arrays.
            steps_to_plot[block_name]["steps"].forEach(function (item, index) {
                if (item["action"] == "rf") {
                    let object_name = item["object"];
                    let flip_angle = parseFloat(data["objects"][object_name]["flipangle"]);
                    let start = item["time"]/step_size + rep*array_size;
                    let object = item["object"];
                    for (let i=0; i<rf_even_data.length; i++) {
                        rf_data.push(rf_even_data[i] * flip_angle);
                        rf_text.push(object);
                        rf_data_x.push(start);
                        start += 2;
                    }
                } else if(item["axis"] == "slice" || item["axis"] == "phase" || item["axis"] == "read") {
                    let start = item["time"]/step_size + rep*array_size;
                    let object = item["object"];
                    let amplitude = parseFloat(data["objects"][object]["amplitude"]);

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
                    let array_data = data["arrays"][array_name]["data"].map(function(x) { return x * amplitude});

                    for (let i=0; i<array_data.length; i++) {
                        if (item["axis"] == "slice") {
                            slice_data.push(array_data[i]);
                            slice_text.push(object);
                            slice_data_x.push(start);
                        } else if (item["axis"] == "phase") {
                            phase_data.push(array_data[i]);
                            phase_text.push(object);
                            phase_data_x.push(start);
                        } else if (item["axis"] == "read") {
                            readout_data.push(array_data[i]);
                            readout_text.push(object);
                            readout_data_x.push(start);
                        }
                        start++;
                    }
                } else if (item["action"] == "adc") {
                    let start = item["time"]/step_size + rep*array_size;
                    let object = item["object"];
                    let duration = data["objects"][object]["duration"]/step_size;

                    adc_data.push(0);
                    adc_text.push(0);
                    adc_data_x.push(start-1);
                    for (let i=0; i<duration; i++) {
                        adc_data.push(1);
                        adc_text.push(object);
                        adc_data_x.push(start);
                        start += 1;
                    }
                    adc_data.push(0);
                    adc_text.push(0);
                    adc_data_x.push(start);
                }
            });
        }
        reps = steps_to_plot[block_name]["reps"];
    }

    // divide all the x data by 100 to get the time in ms
    rf_data_x = rf_data_x.map(x => x/100);
    slice_data_x = slice_data_x.map(x => x/100);
    phase_data_x = phase_data_x.map(x => x/100);
    readout_data_x = readout_data_x.map(x => x/100);
    adc_data_x = adc_data_x.map(x => x/100);

    const plot_rf_data = {
        x: rf_data_x,
        y: rf_data,
        xaxis: 'x1',
        yaxis: 'y1',
        type: 'scatter',
        name: 'RF pulse',
        text: rf_text,
        hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
    };

    const plot_slice_data = {
        x: slice_data_x,
        y: slice_data,
        xaxis: 'x2',
        yaxis: 'y2',
        type: 'scatter',
        name: 'slice',
        text: slice_text,
        hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
    };

    const plot_phase_data = {
        x: phase_data_x,
        y: phase_data,
        xaxis: 'x3',
        yaxis: 'y3',
        type: 'scatter',
        name: 'phase',
        text: phase_text,
        hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
    };

    const plot_readout_data = {
        x: readout_data_x,
        y: readout_data,
        xaxis: 'x4',
        yaxis: 'y4',
        type: 'scatter',
        name: 'readout',
        text: readout_text,
        hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
    };

    const plot_adc_data = {
        x: adc_data_x,
        y: adc_data,
        xaxis: 'x5',
        yaxis: 'y5',
        type: 'scatter',
        name: 'ADC',
        text: adc_text,
        hovertemplate: '<b> %{text}</b><br> %{y:.2f}<extra></extra>'
    };

    var stacked_plots = [plot_rf_data, plot_slice_data, plot_phase_data, plot_readout_data, plot_adc_data];

    var layout = {
        grid: {
            rows: 5,
            columns: 1,
            pattern: 'independent'
        },
        margin: {
            t: 20,
            b: 40,
            // r: 15,
            // l: 60
        },
        plot_bgcolor:"rgba(0,0,0,0.1)",
        paper_bgcolor:"rgba(0,0,0,0.6)",
        height: window.innerHeight,
        showlegend: false,
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
            title: "RF (FA)",
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
        displaylogo: false,
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

    // If shift is pressed, we will show detailed object information.
    const default_hover_template = '<b> %{text}</b><br> %{y:.2f}<extra></extra>';
    myPlot.on('plotly_hover', function(data){
        if (shiftIsPressed) {
            let object_name = data.points[0].text;

            let object_data = objects[object_name];
            let object_data_string = "";
            for (const property in object_data) {
                object_data_string += `${property}: ${object_data[property]} <br>`;
              }
            let shift_hover_template = '<b>' + object_name + '</b><br><br><extra></extra>' +
                                        object_data_string;
            let update = {
                hovertemplate: shift_hover_template
            }
            Plotly.restyle(myPlot, update, [0,1,2,3,4])
        }
    })
     .on('plotly_unhover', function(){
        var update = {
            hovertemplate: default_hover_template
        }
        Plotly.restyle(myPlot, update, [0,1,2,3,4])
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

var json_editor = null;

$(document).ready(function() {
    $("#dummy-file-alert").show();
    plot_sequence(data);
    let content = {
        text: undefined,
        json: data
    }
    json_editor = createJSONEditor({
        target: document.getElementById('jsonviewer'),
        props: {
            content,
            mainMenuBar: false,
            navigationBar: false,
            statusBar: false,
            readOnly: true,
        }
    });

    const fileInput = document.getElementById('formFile');
    fileInput.oninput = () => {
        const selectedFile = fileInput.files[0];
        var reader = new FileReader();
        reader.readAsText(selectedFile, "UTF-8");
        reader.onload = function(e) {
            let newData = JSON.parse(reader.result);
            load_sdl_file(newData);
            json_editor.set({text: undefined, json: newData});
            $("#fileViewerFileName").text("- " + selectedFile.name);
        };
    }

    $("#view-file-btn").click(function () {
        json_editor.expand([], relativePath => relativePath.length < 2);
        $('#fileViewerModal').modal('toggle');
    });

    $('#flexSwitchCheckChecked').click(function(){
        let current_theme = document.documentElement.getAttribute('data-bs-theme');
        if (current_theme == "light") {
            update_theme("dark");
        } else {
            update_theme("light");
        }
    });
});

// Check whether shift button is pressed
$(document).keydown(function(event) {
    if (event.which == "16") {
        shiftIsPressed = true;
    }
});
$(document).keyup(function() {
    shiftIsPressed = false;
});
var shiftIsPressed = false;

var popover = new bootstrap.Popover(document.querySelector('.shortcuts-popover'), {
    container: 'body',
    html: true,
    content: $('[data-name="popover-content"]')
});

function update_theme(toTheme) {
    if (toTheme == "light") {
        document.documentElement.setAttribute('data-bs-theme','light');
        $('input[type="checkbox"]').attr("checked", false);
        $(".btn-secondary").each(function(){
            $(this).removeClass("btn-secondary");
            $(this).addClass("btn-light");
        });
        $("body").css('background', "#f8fafc");
        toggle_plot_color(true);
        $("#plot-col").css({'background': "#ffffff", 'border-left': "1px solid #dfe2e6", 'border-right': "1px solid #dfe2e6"});
        $("#mtrk-logo").hide();
        $("#mtrk-logo-dark").show();
        $("#mtrk-logo").removeClass("d-inline-block");
        $("#mtrk-logo-dark").addClass("d-inline-block");
    }
    else {
        document.documentElement.setAttribute('data-bs-theme','dark');
        $('input[type="checkbox"]').attr("checked", true);
        $(".btn-light").each(function(){
            $(this).removeClass("btn-light");
            $(this).addClass("btn-secondary");
        });
        $("body").css('background', "var(--bs-body-bg)");
        toggle_plot_color(false);
        $("#plot-col").css({'background': "var(--bs-body-bg)", "border-left": "1px solid #34373b", "border-right": "1px solid #34373b"});
        $("#mtrk-logo").show();
        $("#mtrk-logo-dark").hide();
        $("#mtrk-logo-dark").removeClass("d-inline-block");
        $("#mtrk-logo").addClass("d-inline-block");
    }
}

function toggle_plot_color(isDark) {
    if (isDark) {
        var update = {
            "plot_bgcolor":"rgba(255,255,255,0.1)",
            "paper_bgcolor":"rgba(255,255,255,0.1)",
            "title.font.color": 'rgba(0,0,0,0.9)'
        }
        for (let i = 0; i <= 5; i++) {
            let xaxis_number = i;
            if (i == 0) {
                xaxis_number = "";
            }
            update[`xaxis${xaxis_number}.titlefont.color`] = "rgba(0,0,0,0.9)";
            update[`xaxis${xaxis_number}.tickfont.color`] = "rgba(0,0,0,0.9)";
            update[`xaxis${xaxis_number}.gridcolor`] = "rgba(0,0,0,0.05)";
            update[`xaxis${xaxis_number}.zerolinecolor`] = "rgba(0,0,0,0.2)";
            update[`yaxis${xaxis_number}.titlefont.color`] = "rgba(0,0,0,0.9)";
            update[`yaxis${xaxis_number}.tickfont.color`] = "rgba(0,0,0,0.9)";
            update[`yaxis${xaxis_number}.gridcolor`] = "rgba(0,0,0,0.05)";
            update[`yaxis${xaxis_number}.zerolinecolor`] = "rgba(0,0,0,0.2)";
        }
    } else {
        var update = {
            "plot_bgcolor":"rgba(0,0,0,0.1)",
            "paper_bgcolor":"rgba(0,0,0,0.6)",
            "title.font.color": 'rgba(255,255,255,0.9)'
        }
        for (let i = 0; i <= 5; i++) {
            let xaxis_number = i;
            if (i == 0) {
                xaxis_number = "";
            }
            update[`xaxis${xaxis_number}.titlefont.color`] = "rgba(255,255,255,0.9)";
            update[`xaxis${xaxis_number}.tickfont.color`] = "rgba(255,255,255,0.9)";
            update[`xaxis${xaxis_number}.gridcolor`] = "rgba(255,255,255,0.05)";
            update[`xaxis${xaxis_number}.zerolinecolor`] = "rgba(255,255,255,0.1)";
            update[`yaxis${xaxis_number}.titlefont.color`] = "rgba(255,255,255,0.9)";
            update[`yaxis${xaxis_number}.tickfont.color`] = "rgba(255,255,255,0.9)";
            update[`yaxis${xaxis_number}.gridcolor`] = "rgba(255,255,255,0.05)";
            update[`yaxis${xaxis_number}.zerolinecolor`] = "rgba(255,255,255,0.1)";
        }
    }
    Plotly.relayout("chart1", update);
}

function load_sdl_file(sdl_data) {
    try {
        plot_sequence(sdl_data);
        if (document.documentElement.getAttribute('data-bs-theme') == 'dark') {
            toggle_plot_color(false);
        }
        else {
            toggle_plot_color(true);
        }
        $("#alert").hide();
        $("#dummy-file-alert").hide();
        $("#output-sdl-alert").hide();
    } catch ({ name, message }) {
        $("#alert").show();
        console.log(name, message);
    }
}

window.addEventListener('load', function() {
    var loader = document.getElementById('loader');
    loader.style.opacity = '0'; // Fade out loader
    setTimeout(function() {
        loader.style.display = 'none'; // Hide loader
    }, 500); // Wait for fade-out effect to complete
});

var designer_url = 'http://127.0.0.1:5010';
window.addEventListener('message', (event) => {
    if (event.origin === designer_url) {
        let received_sdl = JSON.parse(event.data);
        load_sdl_file(received_sdl);
        json_editor.set({text: undefined, json: received_sdl});
        $("#fileViewerFileName").text("- " + "output_sdl_file.mtrk");
        $("#output-sdl-alert").show();
    }
});