import { Card } from "./Card.ts";
import type { Field } from "./Field.ts";

export class Deck {
  fields: Array<Field>;

  constructor(fields: Array<Field>) {
    this.fields = fields;
  }

  getCard(_seed: string) {
    return new Card(this.fields);
  }
}
