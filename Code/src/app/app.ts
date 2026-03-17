import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { Menu } from "./menu/menu";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet,Menu],
  templateUrl: "./app.html",
  styleUrls: ["./app.css"],
})
export class App {}