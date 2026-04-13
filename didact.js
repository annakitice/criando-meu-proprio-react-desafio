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
  const dom = element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type);

  const isProperty = key => key !== "children";
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name];
    });

  element.props.children.forEach(child => render(child, dom));
  container.appendChild(dom);
}

//MISSION 2: CONCURRENT MODE & FIBER TREE

let nextUnitOfWork = null;
let wipRoot = null; // Será usado na Missão 3

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    // commitRoot() - Será implementado na Missão 3
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  // updateDom será implementado na Missão 3
  if (typeof updateDom === "function") {
    updateDom(dom, {}, fiber.props)
  }
  return dom
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  // reconcileChildren será implementado na Missão 3
  if (typeof reconcileChildren === "function") {
    reconcileChildren(fiber, fiber.props.children)
  }
}

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    // updateFunctionComponent será implementado nas próximas missões
    if (typeof updateFunctionComponent === "function") {
        updateFunctionComponent(fiber)
    }
  } else {
    updateHostComponent(fiber)
  }

  // 1. Return the child, if it exists.
  if (fiber.child) {
    return fiber.child;
  }

  // 2 & 3. Walk up the tree looking for a sibling.
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}

const Didact = { createElement, render };


//TESTE DA MISSÃO 2 (TRAVESSIA DA ÁRVORE)

/* Vamos simular esta árvore:
      A
     / \
    B   D
   /
  C
*/

// 1. Criando as fibers falsas
const fiberC = { type: "C", props: {} };
const fiberB = { type: "B", props: {}, child: fiberC };
const fiberD = { type: "D", props: {} };
const fiberA = { type: "A", props: {}, child: fiberB };

// 2. Conectando pais e irmãos
fiberC.parent = fiberB;
fiberB.parent = fiberA;
fiberD.parent = fiberA;
fiberB.sibling = fiberD;

// 3. Mock temporário da função de update para não tentar tocar no DOM
const originalUpdateHost = updateHostComponent;
updateHostComponent = (fiber) => { 
  console.log("Visiting node:", fiber.type); 
};

// 4. Rodando a lógica do Work Loop manualmente
console.log("--- Starting Fiber Traversal Test ---");
let nextUnit = fiberA;
while (nextUnit) {
  nextUnit = performUnitOfWork(nextUnit);
}
console.log("--- Traversal Finished ---");

// Restaurando a função original para as próximas missões
updateHostComponent = originalUpdateHost;