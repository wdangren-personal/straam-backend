const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Railway
app.set('trust proxy', 1);

// Middleware - CORS for Aidfl.com and Railway (allow all for testing)
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Data directory for POC
const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Simple file-based database helpers
const db = {
  licensees: () => {
    const file = path.join(DATA_DIR, 'licensees.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
  },
  projects: () => {
    const file = path.join(DATA_DIR, 'projects.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
  },
  save: (collection, data) => {
    fs.writeFileSync(path.join(DATA_DIR, `${collection}.json`), JSON.stringify(data, null, 2));
  }
};

// Initialize with demo licensee if empty
if (db.licensees().length === 0) {
  db.save('licensees', [{
    id: 'licensee-001',
    email: 'demo@straamgroup.com',
    password: 'demo123', // POC only - would hash in production
    name: 'Demo Licensee',
    company: 'STRAAM Group Demo',
    createdAt: new Date().toISOString()
  }]);
}

// Multer config for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// ============ AUTH ROUTES ============

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const licensee = db.licensees().find(l => l.email === email && l.password === password);

  if (!licensee) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    id: licensee.id,
    email: licensee.email,
    name: licensee.name,
    company: licensee.company,
    token: `token-${licensee.id}-${Date.now()}` // POC simple token
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, company } = req.body;
  const licensees = db.licensees();

  if (licensees.find(l => l.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newLicensee = {
    id: uuidv4(),
    email,
    password,
    name,
    company,
    createdAt: new Date().toISOString()
  };

  licensees.push(newLicensee);
  db.save('licensees', licensees);

  res.status(201).json({
    id: newLicensee.id,
    email: newLicensee.email,
    name: newLicensee.name,
    company: newLicensee.company
  });
});

// ============ PROJECT ROUTES ============

app.get('/api/projects', (req, res) => {
  const { licenseeId } = req.query;
  let projects = db.projects();

  if (licenseeId) {
    projects = projects.filter(p => p.licenseeId === licenseeId);
  }

  res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.projects().find(p => p.id === req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const {
    licenseeId,
    projectName,
    address,
    city,
    state,
    zipCode,
    buildingHeight,
    ewLength,
    nsLength,
    buildingType,
    ageOfStructure,
    yearBuilt,
    numberOfStories,
    materialType,
    attendance,
    windSpeed,
    windDirection,
    trafficConditions,
    conditionsChanged,
    conditionsNotes,
    visualDescription,
    cracksPresent,
    crackLocations,
    adjacentProperties,
    gapSeparation,
    adjacentBuildingHeights,
    damageObservations,
    sensorSetupComplete,
    sensorPositions,
    generalNotes
  } = req.body;

  const newProject = {
    id: uuidv4(),
    licenseeId,
    projectName,
    address,
    city,
    state,
    zipCode,
    buildingHeight,
    ewLength,
    nsLength,
    buildingType,
    ageOfStructure,
    yearBuilt,
    numberOfStories,
    materialType,
    attendance: attendance || [],
    dateOfAssessment: new Date().toISOString().split('T')[0],
    fieldConditions: {
      windSpeed,
      windDirection,
      trafficConditions,
      conditionsChanged,
      conditionsNotes
    },
    visualInspection: {
      visualDescription,
      cracksPresent,
      crackLocations,
      adjacentProperties,
      gapSeparation,
      adjacentBuildingHeights,
      damageObservations
    },
    sensorSetupComplete,
    sensorPositions: sensorPositions || [],
    generalNotes,
    status: 'draft',
    createdAt: new Date().toISOString(),
    submittedAt: null
  };

  const projects = db.projects();
  projects.push(newProject);
  db.save('projects', projects);

  res.status(201).json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const projects = db.projects();
  const index = projects.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  projects[index] = { ...projects[index], ...req.body, updatedAt: new Date().toISOString() };
  db.save('projects', projects);

  res.json(projects[index]);
});

app.post('/api/projects/:id/submit', (req, res) => {
  const projects = db.projects();
  const index = projects.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  projects[index].status = 'submitted';
  projects[index].submittedAt = new Date().toISOString();
  db.save('projects', projects);

  res.json(projects[index]);
});

app.delete('/api/projects/:id', (req, res) => {
  const projects = db.projects();
  const index = projects.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  projects.splice(index, 1);
  db.save('projects', projects);

  res.json({ success: true });
});

// ============ PHOTO ROUTES ============

app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    size: req.file.size
  });
});

app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ============ EXPORT ROUTES ============

app.get('/api/export/json', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="straam-projects.json"');
  res.json(db.projects());
});

app.get('/api/export/csv', (req, res) => {
  const projects = db.projects();
  const headers = [
    'id', 'projectName', 'address', 'city', 'state', 'zipCode',
    'buildingHeight', 'ewLength', 'nsLength', 'buildingType',
    'ageOfStructure', 'yearBuilt', 'numberOfStories', 'materialType',
    'status', 'createdAt', 'submittedAt'
  ];

  const csv = [
    headers.join(','),
    ...projects.map(p => headers.map(h => `"${p[h] || ''}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Disposition', 'attachment; filename="straam-projects.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// ============ ADMIN ROUTES ============

app.get('/api/admin/stats', (req, res) => {
  const projects = db.projects();
  const licensees = db.licensees();

  res.json({
    totalProjects: projects.length,
    draftProjects: projects.filter(p => p.status === 'draft').length,
    submittedProjects: projects.filter(p => p.status === 'submitted').length,
    totalLicensees: licensees.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`STRAAM Backend API running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
});