export class Field {
  id?: string;
  text: string;

  constructor(text: string, id?: string) {
    this.text = text;
    if (id) this.id = id;
  }
}
