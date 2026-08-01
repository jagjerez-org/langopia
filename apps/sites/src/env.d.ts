/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    site: import("./public-site").PublicSiteSummary;
  }
}
