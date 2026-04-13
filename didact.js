function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}


function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

function render(element, container) {
  //Criar o nó do DOM
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type);

  //Atribuir as propriedades (props)
  const isProperty = key => key !== "children";
  
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name];
    });

  //Chamar recursivamente o render para cada filho
  element.props.children.forEach(child =>
    render(child, dom)
  );

  //Adicionar o nó criado ao container pai
  container.appendChild(dom);
}

const Didact = { createElement, render };


//CÓDIGO DE TESTE (MISSÃO 1)


// Criando a árvore de elementos manualmente 
const element = Didact.createElement(
  "div",
  { style: "background: salmon; padding: 20px; border-radius: 8px; font-family: sans-serif;" },
  Didact.createElement("h1", { style: "color: white;" }, "Mission 1: Success! 🎉"),
  Didact.createElement("p", null, "If you can see this, your DOM creation is working.")
);

// Pegando o container raiz do HTML
const container = document.getElementById("root");

// Renderizando na tela
Didact.render(element, container);