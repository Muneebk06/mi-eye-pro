"use client";

import Dexie from "dexie";
import { useState, useEffect } from "react";


export const db = new Dexie("StudentDB");

db.version(1).stores({
  students: "++id, name, semester, cgpa",
});

export default function StudentPage() {
  const [students, setStudents] = useState([]);


  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [cgpa, setCgpa] = useState("");


  const [editId, setEditId] = useState(null);
  const [searchSemester, setSearchSemester] = useState("");

  const getAllStudents = async () => {
    const all = await db.students.toArray();
    setStudents(all);
  };

  useEffect(() => {
    getAllStudents();
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editId !== null) {
      
      await db.students.update(editId, {
        name: name,
        semester: Number(semester),
        cgpa: Number(cgpa),
      });
      setEditId(null);
      alert("Student updated!");
    } else {
      
      await db.students.add({
        name: name,
        semester: Number(semester),
        cgpa: Number(cgpa),
      });
      alert("Student added!");
    }

    
    setName("");
    setSemester("");
    setCgpa("");
    getAllStudents();
  };

  
  const handleEdit = (s) => {
    setEditId(s.id);
    setName(s.name);
    setSemester(s.semester);
    setCgpa(s.cgpa);
  };

  
  const filterByCgpa = async () => {
    const result = await db.students.where("cgpa").above(3.5).toArray();
    setStudents(result);
  };

  
  const filterBySemester = async () => {
    if (searchSemester === "") {
      getAllStudents();
      return;
    }
    const result = await db.students
      .where("semester")
      .equals(Number(searchSemester))
      .toArray();
    setStudents(result);
  };

  return (
    <main style={{ backgroundColor: "white", color: "black", padding: "20px", minHeight: "100vh" }}>
      <h1>Student List</h1>

      {/* ADD / UPDATE FORM */}
      <form onSubmit={handleSubmit}>
        <label>Name: </label>
        <input
          type="text"
          placeholder="Enter Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <br /><br />

        <label>Semester: </label>
        <input
          type="number"
          placeholder="Enter Semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          required
        />
        <br /><br />

        <label>CGPA: </label>
        <input
          type="number"
          step="0.01"
          placeholder="Enter CGPA"
          value={cgpa}
          onChange={(e) => setCgpa(e.target.value)}
          required
        />
        <br /><br />

        <button type="submit">
          {editId !== null ? "Update Student" : "Add Student"}
        </button>
      </form>

      <hr />

      {/* FILTER BUTTONS */}
      <div>
        <button type="button" onClick={getAllStudents}>
          Get All Students
        </button>

        <button type="button" onClick={filterByCgpa} style={{ marginLeft: "10px" }}>
          Filter CGPA &gt; 3.5
        </button>

        <br /><br />

        <input
          type="number"
          placeholder="Enter Semester to filter"
          value={searchSemester}
          onChange={(e) => setSearchSemester(e.target.value)}
        />
        <button type="button" onClick={filterBySemester} style={{ marginLeft: "10px" }}>
          Filter by Semester
        </button>
      </div>

      <hr />

      {/* STUDENTS TABLE */}
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Semester</th>
            <th>CGPA</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.semester}</td>
              <td>{s.cgpa}</td>
              <td>
                <button type="button" onClick={() => handleEdit(s)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}