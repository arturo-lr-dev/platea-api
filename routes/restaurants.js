const express = require('express');
const router = express.Router();

const mockRestaurant = {
  id: "demo-restaurant",
  name: "La Maison Gourmet",
  logo: {
    type: "image",
    content: "La Maison Gourmet",
    imageUrl: "https://placehold.co/200x80/png"
  },
  slogan: "Una experiencia culinaria extraordinaria",
  description: "Descubre la fusión perfecta entre la cocina tradicional y la innovación moderna",
  ui: {
    heroButtonText: "Reserva tu experiencia",
    heroBackgroundImage: "https://placehold.co/600x400/png"
  },
  history: {
    content: "Fundado en 2010, La Maison Gourmet nació de la pasión por la gastronomía y el deseo de crear experiencias únicas...",
    chef: {
      name: "Carlos Martínez",
      bio: "Con más de 20 años de experiencia en restaurantes de prestigio internacional...",
      image: "https://placehold.co/600x400/000000/FFFFFF/png"
    },
    team: [
      {
        name: "Ana García",
        position: "Sommelier",
        description: "Experta en vinos con certificación internacional...",
        image: "https://placehold.co/600x400/000000/FFFFFF/png"
      },
      {
        name: "Pedro López",
        position: "Chef Pastelero",
        description: "Maestro en el arte de la repostería francesa...",
        image: "https://placehold.co/600x400/000000/FFFFFF/png"
      }
    ]
  },
  menu: {
    featured: [
      {
        id: "plato-1",
        name: "Risotto de Setas Silvestres",
        description: "Cremoso risotto con selección de setas de temporada y trufa negra",
        price: 24.50,
        image: "https://placehold.co/600x400/png",
        ingredients: ["Arroz arborio", "Setas silvestres", "Trufa negra", "Parmesano"],
        seasonal: true
      },
      {
        id: "plato-2",
        name: "Lubina al Horno",
        description: "Lubina salvaje con verduras de temporada y salsa de cítricos",
        price: 32.00,
        image: "https://placehold.co/600x400/png",
        ingredients: ["Lubina", "Verduras", "Cítricos", "Hierbas aromáticas"],
        seasonal: false
      }
    ],
    fullMenu: {
      starters: [
        {
          id: "starter-1",
          name: "Carpaccio de Ternera",
          description: "Finas láminas de ternera con rúcula, parmesano y aceite de trufa",
          price: 18.50,
          image: "https://placehold.co/600x400/png",
          ingredients: ["Ternera", "Rúcula", "Parmesano", "Aceite de trufa"]
        },
        {
          id: "starter-2",
          name: "Tartar de Atún",
          description: "Atún rojo marinado con aguacate y cítricos",
          price: 22.00,
          image: "https://placehold.co/600x400/png",
          ingredients: ["Atún rojo", "Aguacate", "Cítricos", "Sésamo"]
        }
      ],
      mainCourses: [
        {
          id: "main-1",
          name: "Solomillo Wellington",
          description: "Solomillo de ternera envuelto en hojaldre con duxelles de setas",
          price: 34.00,
          image: "https://placehold.co/600x400/png",
          ingredients: ["Solomillo", "Hojaldre", "Setas", "Foie"]
        },
        {
          id: "main-2",
          name: "Rape a la Marinera",
          description: "Medallones de rape con salsa marinera y almejas",
          price: 28.00,
          image: "https://placehold.co/600x400/png",
          ingredients: ["Rape", "Almejas", "Gambas", "Fumet"]
        }
      ],
      desserts: [
        {
          id: "dessert-1",
          name: "Tarta de Chocolate",
          description: "Tarta de chocolate belga con helado de vainilla",
          price: 12.00,
          image: "https://placehold.co/600x400/png",
          ingredients: ["Chocolate belga", "Vainilla", "Nata", "Frutos rojos"]
        },
        {
          id: "dessert-2",
          name: "Crema Catalana",
          description: "Crema catalana tradicional con azúcar caramelizado",
          price: 9.00,
          image: "https://placehold.co/600x400/png",
          ingredients: ["Leche", "Huevos", "Canela", "Azúcar"]
        }
      ]
    },
    wine: [
      {
        id: "vino-1",
        name: "Ribera del Duero Reserva",
        description: "Vino tinto con notas de frutos rojos y especias",
        price: 45.00,
        year: 2018
      },
      {
        id: "vino-2",
        name: "Albariño Rías Baixas",
        description: "Vino blanco fresco y aromático",
        price: 32.00,
        year: 2021
      }
    ]
  },
  reservations: {
    schedule: {
      open: "13:00",
      close: "23:00"
    },
    closedDays: ["Lunes"],
    maxPartySize: 10,
    specialNotes: "Para grupos mayores de 6 personas, por favor contactar directamente"
  },
  contact: {
    phone: "+34 912 345 678",
    email: "reservas@lamaisongourmet.com",
    address: "Calle Principal 123, 28001 Madrid",
    coordinates: {
      lat: 40.416775,
      lng: -3.703790
    }
  },
  giftCards: {
    prefix: "gc",
    validityDays: 365
  }
};

router.get('/:id', function(req, res, next) {
  const { id } = req.params;
  if (id === mockRestaurant.id) {
    res.json(mockRestaurant);
  } else {
    res.status(404).json({ error: 'Restaurant not found' });
  }
});

module.exports = router;
