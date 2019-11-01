import * as React from "react";
import "./ControlPanel.less";
import { RunButton } from "./RunButton";

export function ControlPanel() {
    return <div className="control-panel w3-top w3-teal">
                <div className="w3-bar">
                    <RunButton />
                    <button className="w3-button w3-white">Diagram</button>
                    <button className="w3-button w3-white w3-right">Share</button>
                </div>
            </div>;
}